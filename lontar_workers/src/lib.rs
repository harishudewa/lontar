use jwt_simple::prelude::Ed25519KeyPair;
use serde::{Deserialize, Serialize};
use worker::{Context, Env, Request, Response, RouteContext, Router, event};

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> worker::Result<Response> {
    let res = Router::new()
        .get_async("/", async move |_req, _ctx| Response::from_html("Hello"))
        .get_async("/gen-key", gen_key)
        .post_async("/signin", signin)
        .run(req, env)
        .await?;
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
