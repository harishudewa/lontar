use std::collections::HashMap;

use jwt_simple::prelude::Ed25519KeyPair;
use serde::{Deserialize, Serialize};
use serde_json::json;
use worker::{
    Context, Env, Headers, HttpMetadata, Method, Request, Response, RouteContext, Router, event,
};

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> worker::Result<Response> {
    let cors = worker::Cors::new()
        .with_origins(vec!["http://localhost:3000"])
        .with_methods(vec![
            Method::Post,
            Method::Get,
            Method::Put,
            Method::Options,
        ])
        .with_allowed_headers(vec!["Content-Type", "Authorization"])
        .with_credentials(true);

    let res = Router::new()
        .get_async("/", async move |_req, _ctx| Response::from_html("Hello"))
        .get_async("/gen-key", gen_key)
        .get_async("/images/:key", image_get)
        .post_async("/signin", signin)
        .post_async("/images", image_upload)
        .options("/images", move |_req, _ctx| Response::empty())
        .run(req, env)
        .await?
        .with_cors(&cors)?;

    Ok(res)
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SigninRequest {
    pub username: String,
    pub password: String,
}

pub async fn signin(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let app_root_username = ctx.env.secret("APP_ROOT_USERNAME")?;
    let app_root_password = ctx.env.secret("APP_ROOT_PASSWORD")?;

    let req_json: SigninRequest = req.json().await?;

    Response::from_json(&req_json)
}

pub async fn gen_key(_req: Request, _ctx: RouteContext<()>) -> worker::Result<Response> {
    let key_pair = Ed25519KeyPair::generate();
    let key_pair_str = key_pair.to_pem();

    Response::from_html(key_pair_str)
}

pub async fn image_upload(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let bucket = ctx.env.bucket("lontar_bucket")?;
    let stream = req.inner().body().unwrap();

    let mut custom_metadata = HashMap::new();
    custom_metadata.insert(String::from("enc-alg"), String::from("XChaCha20Poly-1305"));
    let obj_key = format!("img-{}", uuid::Uuid::now_v7());

    bucket
        .put(&obj_key, stream)
        .http_metadata(HttpMetadata {
            content_type: Some(String::from("application/octet-stream")),
            ..Default::default()
        })
        .custom_metadata(custom_metadata)
        .execute()
        .await?;

    Response::from_json(&json!({
        "obj_key": obj_key
    }))
}

pub async fn image_get(_req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let obj_key = match ctx.param("key") {
        Some(key) => key,
        None => return Response::error("Key not provided", 400),
    };

    let bucket = ctx.env.bucket("lontar_bucket")?;
    let obj = bucket.get(obj_key).execute().await?.unwrap();

    let body = match obj.body() {
        Some(body) => body,
        None => return Response::error("Object has no body", 500),
    };
    let response_body = body.response_body()?;

    let headers = Headers::new();
    headers.set("Content-Type", "image/jpeg")?;
    headers.set("Cache-Control", "public, max-age=31536000")?;

    Ok(Response::from_body(response_body)?.with_headers(headers))
}
