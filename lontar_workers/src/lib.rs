use std::collections::HashMap;

use jwt_simple::prelude::Ed25519KeyPair;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use worker::{
    Context, Env, Headers, HttpMetadata, Method, Request, Response, RouteContext, Router, event,
    wasm_bindgen::JsValue,
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
            Method::Patch,
        ])
        .with_allowed_headers(vec!["Content-Type", "Authorization"])
        .with_credentials(true);

    let res = Router::new()
        .get_async("/", async move |_req, _ctx| Response::from_html("Hello"))
        .get_async("/gen-key", gen_key)
        .get_async("/images/:key", image_get)
        .get_async("/notes/:note_id", note_get)
        .post_async("/signin", signin)
        .post_async("/images", image_upload)
        .options("/images", move |_req, _ctx| Response::empty())
        .post_async("/notes", note_create)
        .patch_async("/notes/:note_id", note_update)
        .options("/notes", move |_req, _ctx| Response::empty())
        .options("/notes/:note_id", move |_req, _ctx| Response::empty())
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

#[derive(Deserialize, Serialize, Debug)]
pub struct Note {
    pub id: String,
    pub version: u32,
    pub content: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub deleted_at: Option<u64>,
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

#[derive(Deserialize, Serialize)]
pub struct NoteUpdateRequestJson {
    pub metadata: Option<String>,
    pub content: Option<String>,
}

#[derive(Deserialize, Serialize)]
pub struct NoteUpdateResponse {
    pub note_id: String,
}

pub async fn note_update(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let payload_json: NoteUpdateRequestJson = match req.json().await {
        Ok(p) => p,
        Err(_) => return Response::error("Invalid request body", 400),
    };

    let id = match ctx.param("note_id") {
        Some(id) => id,
        None => return Response::error("Invalid note id", 400),
    };

    if payload_json.metadata.is_none() && payload_json.content.is_none() {
        return Response::error("Invalid metadata and content", 400);
    }

    let metadata = match payload_json.metadata {
        Some(v) => JsValue::from_str(&v),
        None => JsValue::NULL,
    };
    let content = match payload_json.content {
        Some(v) => JsValue::from_str(&v),
        None => JsValue::NULL,
    };

    let db = ctx.d1("lontar_db")?;
    let statement = db.prepare(
        "UPDATE notes
        SET
        metadata    = COALESCE(?2, metadata),
        content     = COALESCE(?3, content),
        version     = version + 1,
        updated_at  = unixepoch()
        WHERE id = ?1",
    );
    let query = statement.bind(&[JsValue::from_str(id), metadata, content])?;
    let result = query.run().await?;

    if let Some(e) = result.error() {
        return Response::error(e, 500);
    }

    let response = NoteUpdateResponse {
        note_id: id.to_owned(),
    };

    Response::from_json(&response)
}

pub async fn note_get(_req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let note_id = match ctx.param("note_id") {
        Some(val) => val,
        None => return Response::error("invalid note id", 400),
    };

    let db = ctx.d1("lontar_db")?;
    let statement = db.prepare("SELECT * FROM notes WHERE id = ?1");
    let query = statement.bind(&[JsValue::from_str(&note_id)])?;
    let result = query.first::<Note>(None).await?;

    match result {
        Some(note) => Response::from_json(&note),
        None => Response::error("not found", 404),
    }
}

#[derive(Deserialize, Serialize)]
pub struct NoteCreateRequestJson {
    pub metadata: String,
}

#[derive(Deserialize, Serialize)]
pub struct NoteCreateResponse {
    pub note_id: String,
}

pub async fn note_create(mut req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let payload_json: NoteCreateRequestJson = match req.json().await {
        Ok(p) => p,
        Err(_) => return Response::error("Invalid request body", 400),
    };

    let id = Uuid::now_v7().to_string();

    let db = ctx.d1("lontar_db")?;
    let statement = db.prepare("INSERT INTO notes (id, version, metadata) VALUES (?1, ?2, ?3)");
    let query = statement.bind(&[
        JsValue::from_str(&id),
        JsValue::from_f64(1 as f64),
        JsValue::from_str(&payload_json.metadata),
    ])?;
    let result = query.run().await?;

    if let Some(e) = result.error() {
        return Response::error(e, 500);
    }

    let response = NoteCreateResponse { note_id: id };

    Response::from_json(&response)
}
