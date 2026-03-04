use scraper::{Html, Selector};
use serde::Serialize;
use worker::*;

#[derive(Serialize)]
struct MarketRate {
    asset_code: String,
    asset_type: String,
    buy_price: f64,
    sell_price: f64,
}

#[event(scheduled)]
async fn scheduled(_event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    console_log!("Market scraper triggered");

    let supabase_url = env.var("SUPABASE_URL").unwrap().to_string();
    let supabase_key = env.secret("SUPABASE_SERVICE_ROLE_KEY").unwrap().to_string();

    if let Err(e) = scrape_gold(&supabase_url, &supabase_key).await {
        console_error!("Gold scraper error: {}", e);
    }

    if let Err(e) = scrape_stocks(&supabase_url, &supabase_key).await {
        console_error!("Stock scraper error: {}", e);
    }

    console_log!("Market scraper completed");
}

async fn scrape_gold(supabase_url: &str, supabase_key: &str) -> Result<()> {
    let mut buy_resp = Fetch::Url(
        Url::parse("https://www.logammulia.com/id/harga-emas-hari-ini")
            .map_err(|e| Error::RustError(e.to_string()))?,
    )
    .send()
    .await?;
    let buy_html = buy_resp.text().await?;

    let buy_price = parse_gold_price(&buy_html, "buy")
        .ok_or_else(|| Error::RustError("Failed to parse gold buy price".into()))?;

    let mut sell_resp = Fetch::Url(
        Url::parse("https://www.logammulia.com/id/sell/gold")
            .map_err(|e| Error::RustError(e.to_string()))?,
    )
    .send()
    .await?;
    let sell_html = sell_resp.text().await?;

    let sell_price = parse_gold_price(&sell_html, "sell")
        .ok_or_else(|| Error::RustError("Failed to parse gold sell price".into()))?;

    console_log!("Gold prices - buy: {}, sell: {}", buy_price, sell_price);

    let rate = MarketRate {
        asset_code: "ANTAM".to_string(),
        asset_type: "gold".to_string(),
        buy_price,
        sell_price,
    };

    upsert_market_rate(supabase_url, supabase_key, &rate).await?;

    Ok(())
}

fn parse_gold_price(html: &str, price_type: &str) -> Option<f64> {
    let document = Html::parse_document(html);

    match price_type {
        "buy" => {
            let row_sel = Selector::parse("table tbody tr").ok()?;
            for row in document.select(&row_sel) {
                let text: String = row.text().collect();
                if text.contains("1 gr") || text.contains("1gr") {
                    let price = extract_number(&text)?;
                    return Some(price);
                }
            }
            None
        }
        "sell" => {
            let sel = Selector::parse("#valBasePrice").ok()?;
            if let Some(el) = document.select(&sel).next() {
                let text: String = el.text().collect();
                return extract_number(&text);
            }
            let sel = Selector::parse(".price, .harga").ok()?;
            if let Some(el) = document.select(&sel).next() {
                let text: String = el.text().collect();
                return extract_number(&text);
            }
            None
        }
        _ => None,
    }
}

fn extract_number(text: &str) -> Option<f64> {
    let cleaned: String = text
        .replace("Rp", "")
        .replace('.', "")
        .replace(',', ".")
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    cleaned.parse::<f64>().ok()
}

async fn scrape_stocks(supabase_url: &str, supabase_key: &str) -> Result<()> {
    let tickers = ["BBCA", "BBRI", "TLKM", "BMRI"];

    let mut resp = Fetch::Url(
        Url::parse(
            "https://www.idx.co.id/primary/TradingSummary/GetStockSummary?length=9999&start=0",
        )
        .map_err(|e| Error::RustError(e.to_string()))?,
    )
    .send()
    .await?;

    let body = resp.text().await?;
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| Error::RustError(format!("IDX JSON parse error: {}", e)))?;

    let data = json["data"]
        .as_array()
        .ok_or_else(|| Error::RustError("IDX response missing data array".into()))?;

    for item in data {
        let code = item["StockCode"].as_str().unwrap_or("");
        if !tickers.contains(&code) {
            continue;
        }

        let close = item["Close"].as_f64().unwrap_or(0.0);

        let rate = MarketRate {
            asset_code: code.to_string(),
            asset_type: "stock".to_string(),
            buy_price: close,
            sell_price: close,
        };

        console_log!("Stock {} - price: {}", code, close);

        if let Err(e) = upsert_market_rate(supabase_url, supabase_key, &rate).await {
            console_error!("Failed to upsert {}: {}", code, e);
        }
    }

    Ok(())
}

async fn upsert_market_rate(
    supabase_url: &str,
    supabase_key: &str,
    rate: &MarketRate,
) -> Result<()> {
    let url = format!(
        "{}/rest/v1/market_rates?on_conflict=asset_code",
        supabase_url
    );

    let body =
        serde_json::to_string(rate).map_err(|e| Error::RustError(e.to_string()))?;

    let mut headers = Headers::new();
    headers.set("apikey", supabase_key)?;
    headers.set("Authorization", &format!("Bearer {}", supabase_key))?;
    headers.set("Content-Type", "application/json")?;
    headers.set("Prefer", "resolution=merge-duplicates")?;

    let request = Request::new_with_init(
        &url,
        RequestInit::new()
            .with_method(Method::Post)
            .with_headers(headers)
            .with_body(Some(body.into())),
    )?;

    let mut resp = Fetch::Request(request).send().await?;
    let status = resp.status_code();

    if status >= 400 {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(Error::RustError(format!(
            "Supabase upsert failed ({}): {}",
            status, err_text
        )));
    }

    console_log!("Upserted {} successfully", rate.asset_code);
    Ok(())
}
