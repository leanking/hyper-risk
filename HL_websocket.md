# HyperLiquid API Documentation

This document provides a comprehensive overview of the HyperLiquid API methods for both WebSocket and REST endpoints. The documentation is structured to be easily understood by LLMs and developers working across different programming languages.

## Table of Contents

1. [Introduction](#introduction)
   - [API Base Addresses](#api-base-addresses)
2. [WebSocket API](#websocket-api)
   - [Subscription Types](#subscription-types)
   - [Message Types](#message-types)
   - [Data Structures](#data-structures)
3. [REST API](#rest-api)
   - [Exchange Methods](#exchange-methods)
   - [Information Methods](#information-methods)
4. [Common Data Structures](#common-data-structures)
5. [Error Handling](#error-handling)

## Introduction

HyperLiquid provides both WebSocket and REST API endpoints for interacting with the exchange. The WebSocket API is used for real-time data streaming, while the REST API is used for executing trades, managing orders, and retrieving account information.

### API Base Addresses

#### WebSocket API
- Mainnet: `wss://api.hyperliquid.xyz/ws`
- Testnet: `wss://api.testnet.hyperliquid.xyz/ws`

#### REST API
- Mainnet: `https://api.hyperliquid.xyz`
- Testnet: `https://api.testnet.hyperliquid.xyz`

The examples in this documentation use the mainnet endpoints. For testnet usage, replace the mainnet URLs with the corresponding testnet URLs.

## WebSocket API

The WebSocket API allows you to subscribe to real-time data streams from the HyperLiquid exchange.

### Subscription Types

The following subscription types are available:

| Subscription Type | Description | Parameters |
|-------------------|-------------|------------|
| `AllMids` | Subscribe to all mid prices | None |
| `Notification` | Subscribe to user notifications | `user`: H160 (Ethereum address) |
| `WebData2` | Subscribe to user web data | `user`: H160 (Ethereum address) |
| `Candle` | Subscribe to candle data | `coin`: String, `interval`: String |
| `L2Book` | Subscribe to L2 order book data | `coin`: String |
| `Trades` | Subscribe to trade data | `coin`: String |
| `OrderUpdates` | Subscribe to order updates | `user`: H160 (Ethereum address) |
| `UserEvents` | Subscribe to user events | `user`: H160 (Ethereum address) |
| `UserFills` | Subscribe to user fills | `user`: H160 (Ethereum address) |
| `UserFundings` | Subscribe to user fundings | `user`: H160 (Ethereum address) |
| `UserNonFundingLedgerUpdates` | Subscribe to user non-funding ledger updates | `user`: H160 (Ethereum address) |
| `ActiveAssetCtx` | Subscribe to active asset context | `coin`: String |

### Message Types

When subscribed to a WebSocket stream, you will receive messages of the following types:

| Message Type | Description | Associated Data Structure |
|--------------|-------------|---------------------------|
| `NoData` | No data available | None |
| `HyperliquidError` | Error message | String |
| `AllMids` | All mid prices | `AllMids` |
| `Trades` | Trade data | `Trades` |
| `L2Book` | L2 order book data | `L2Book` |
| `User` | User data | `User` |
| `UserFills` | User fills data | `UserFills` |
| `Candle` | Candle data | `Candle` |
| `SubscriptionResponse` | Subscription response | None |
| `OrderUpdates` | Order updates | `OrderUpdates` |
| `UserFundings` | User fundings | `UserFundings` |
| `UserNonFundingLedgerUpdates` | User non-funding ledger updates | `UserNonFundingLedgerUpdates` |
| `Notification` | Notification | `Notification` |
| `WebData2` | Web data | `WebData2` |
| `ActiveAssetCtx` | Active asset context | `ActiveAssetCtx` |
| `Pong` | Pong response | None |

### Data Structures

#### Trade

```rust
pub struct Trade {
    pub coin: String,
    pub side: String,
    pub px: String,
    pub sz: String,
    pub time: u64,
    pub hash: String,
    pub tid: u64,
}
```

#### BookLevel

```rust
pub struct BookLevel {
    pub px: String,
    pub sz: String,
    pub n: u64,
}
```

#### L2BookData

```rust
pub struct L2BookData {
    pub coin: String,
    pub time: u64,
    pub levels: Vec<Vec<BookLevel>>,
}
```

#### AllMidsData

```rust
pub struct AllMidsData {
    pub mids: HashMap<String, String>,
}
```

#### TradeInfo

```rust
pub struct TradeInfo {
    pub coin: String,
    pub side: String,
    pub px: String,
    pub sz: String,
    pub time: u64,
    pub hash: String,
    pub start_position: String,
    pub dir: String,
    pub closed_pnl: String,
    pub oid: u64,
    pub cloid: Option<String>,
    pub crossed: bool,
    pub fee: String,
    pub tid: u64,
}
```

#### UserFillsData

```rust
pub struct UserFillsData {
    pub is_snapshot: Option<bool>,
    pub user: H160,
    pub fills: Vec<TradeInfo>,
}
```

#### CandleData

```rust
pub struct CandleData {
    pub time_close: u64,
    pub close: String,
    pub high: String,
    pub interval: String,
    pub low: String,
    pub num_trades: u64,
    pub open: String,
    pub coin: String,
    pub time_open: u64,
    pub volume: String,
}
```

#### OrderUpdate

```rust
pub struct OrderUpdate {
    pub order: BasicOrder,
    pub status: String,
    pub status_timestamp: u64,
}
```

#### BasicOrder

```rust
pub struct BasicOrder {
    pub coin: String,
    pub side: String,
    pub limit_px: String,
    pub sz: String,
    pub oid: u64,
    pub timestamp: u64,
    pub orig_sz: String,
    pub cloid: Option<String>,
}
```

## REST API

The REST API provides methods for executing trades, managing orders, and retrieving account information.

### Exchange Methods

#### Order Management

| Method | Description | Parameters |
|--------|-------------|------------|
| `order` | Place a single order | `order`: ClientOrderRequest, `wallet`: Option<&LocalWallet> |
| `order_with_builder` | Place a single order with builder | `order`: ClientOrderRequest, `wallet`: Option<&LocalWallet>, `builder`: BuilderInfo |
| `bulk_order` | Place multiple orders | `orders`: Vec<ClientOrderRequest>, `wallet`: Option<&LocalWallet> |
| `bulk_order_with_builder` | Place multiple orders with builder | `orders`: Vec<ClientOrderRequest>, `wallet`: Option<&LocalWallet>, `builder`: BuilderInfo |
| `cancel` | Cancel a single order | `cancel`: ClientCancelRequest, `wallet`: Option<&LocalWallet> |
| `bulk_cancel` | Cancel multiple orders | `cancels`: Vec<ClientCancelRequest>, `wallet`: Option<&LocalWallet> |
| `cancel_by_cloid` | Cancel an order by client order ID | `cancel`: ClientCancelRequestCloid, `wallet`: Option<&LocalWallet> |
| `bulk_cancel_by_cloid` | Cancel multiple orders by client order ID | `cancels`: Vec<ClientCancelRequestCloid>, `wallet`: Option<&LocalWallet> |
| `modify` | Modify a single order | `modify`: ClientModifyRequest, `wallet`: Option<&LocalWallet> |
| `bulk_modify` | Modify multiple orders | `modifies`: Vec<ClientModifyRequest>, `wallet`: Option<&LocalWallet> |

#### Market Orders

| Method | Description | Parameters |
|--------|-------------|------------|
| `market_open` | Open a market position | `params`: MarketOrderParams<'_> |
| `market_open_with_builder` | Open a market position with builder | `params`: MarketOrderParams<'_>, `builder`: BuilderInfo |
| `market_close` | Close a market position | `params`: MarketCloseParams<'_> |

#### Account Management

| Method | Description | Parameters |
|--------|-------------|------------|
| `usdc_transfer` | Transfer USDC | `amount`: &str, `destination`: &str, `wallet`: Option<&LocalWallet> |
| `class_transfer` | Transfer between account classes | `usdc`: f64, `to_perp`: bool, `wallet`: Option<&LocalWallet> |
| `vault_transfer` | Transfer to/from vault | `is_deposit`: bool, `usd`: String, `vault_address`: Option<H160>, `wallet`: Option<&LocalWallet> |
| `update_leverage` | Update leverage | `leverage`: u32, `coin`: &str, `is_cross`: bool, `wallet`: Option<&LocalWallet> |
| `update_isolated_margin` | Update isolated margin | `amount`: f64, `coin`: &str, `wallet`: Option<&LocalWallet> |
| `approve_agent` | Approve agent | `wallet`: Option<&LocalWallet> |
| `withdraw_from_bridge` | Withdraw from bridge | `amount`: &str, `destination`: &str, `wallet`: Option<&LocalWallet> |
| `spot_transfer` | Transfer spot tokens | `amount`: &str, `destination`: &str, `token`: &str, `wallet`: Option<&LocalWallet> |
| `set_referrer` | Set referrer | `code`: String, `wallet`: Option<&LocalWallet> |
| `approve_builder_fee` | Approve builder fee | `builder`: String, `max_fee_rate`: String, `wallet`: Option<&LocalWallet> |

### Information Methods

#### Account Information

| Method | Description | Parameters |
|--------|-------------|------------|
| `user_state` | Get user state | `address`: H160 |
| `user_states` | Get multiple user states | `addresses`: Vec<H160> |
| `user_token_balances` | Get user token balances | `address`: H160 |
| `user_fees` | Get user fees | `address`: H160 |
| `open_orders` | Get open orders | `address`: H160 |
| `user_fills` | Get user fills | `address`: H160 |
| `user_funding_history` | Get user funding history | `user`: H160, `start_time`: u64, `end_time`: Option<u64> |
| `query_order_by_oid` | Query order by order ID | `address`: H160, `oid`: u64 |
| `query_referral_state` | Query referral state | `address`: H160 |
| `historical_orders` | Get historical orders | `address`: H160 |

#### Market Information

| Method | Description | Parameters |
|--------|-------------|------------|
| `meta` | Get exchange metadata | None |
| `spot_meta` | Get spot metadata | None |
| `spot_meta_and_asset_contexts` | Get spot metadata and asset contexts | None |
| `all_mids` | Get all mid prices | None |
| `funding_history` | Get funding history | `coin`: String, `start_time`: u64, `end_time`: Option<u64> |
| `recent_trades` | Get recent trades | `coin`: String |
| `l2_snapshot` | Get L2 order book snapshot | `coin`: String |
| `candles_snapshot` | Get candles snapshot | `coin`: String, `interval`: String, `start_time`: u64, `end_time`: u64 |

## Common Data Structures

### Actions

```rust
pub enum Actions {
    UsdSend(UsdSend),
    UpdateLeverage(UpdateLeverage),
    UpdateIsolatedMargin(UpdateIsolatedMargin),
    Order(BulkOrder),
    Cancel(BulkCancel),
    CancelByCloid(BulkCancelCloid),
    BatchModify(BulkModify),
    ApproveAgent(ApproveAgent),
    Withdraw3(Withdraw3),
    SpotUser(SpotUser),
    VaultTransfer(VaultTransfer),
    SpotSend(SpotSend),
    SetReferrer(SetReferrer),
    ApproveBuilderFee(ApproveBuilderFee),
}
```

### InfoRequest

```rust
pub enum InfoRequest {
    UserState { user: H160 },
    UserStates { users: Vec<H160> },
    UserTokenBalances { user: H160 },
    UserFees { user: H160 },
    OpenOrders { user: H160 },
    OrderStatus { user: H160, oid: u64 },
    Meta,
    SpotMeta,
    SpotMetaAndAssetCtxs,
    AllMids,
    UserFills { user: H160 },
    FundingHistory { coin: String, start_time: u64, end_time: Option<u64> },
    UserFunding { user: H160, start_time: u64, end_time: Option<u64> },
    L2Book { coin: String },
    RecentTrades { coin: String },
    CandleSnapshot { req: CandleSnapshotRequest },
    Referral { user: H160 },
    HistoricalOrders { user: H160 },
}
```

## Error Handling

The API returns errors in the following format:

```rust
pub enum Error {
    HttpError(String),
    JsonParse(String),
    RmpParse(String),
    WebSocketError(String),
    InvalidResponse(String),
    InvalidSignature,
    InvalidAddress,
    InvalidAmount,
    InvalidCoin,
    InvalidLeverage,
    InvalidMargin,
    InvalidPrice,
    InvalidSize,
    InvalidSlippage,
    InvalidSide,
    InvalidOrderType,
    InvalidTimeInForce,
    InvalidReduceOnly,
    InvalidPostOnly,
    InvalidTriggerPrice,
    InvalidTriggerCondition,
    InvalidTriggerType,
    InvalidTriggerTimeInForce,
    InvalidTriggerReduceOnly,
    InvalidTriggerPostOnly,
    InvalidTriggerSize,
    InvalidTriggerPrice2,
    InvalidTriggerCondition2,
    InvalidTriggerType2,
    InvalidTriggerTimeInForce2,
    InvalidTriggerReduceOnly2,
    InvalidTriggerPostOnly2,
    InvalidTriggerSize2,
    InvalidOrderId,
    InvalidClientOrderId,
    InvalidInterval,
    InvalidStartTime,
    InvalidEndTime,
    InvalidLimit,
    InvalidOffset,
    InvalidStatus,
    InvalidTimestamp,
    InvalidSignatureTimestamp,
    InvalidNonce,
    InvalidVaultAddress,
    InvalidReferrerCode,
    InvalidBuilderAddress,
    InvalidMaxFeeRate,
    Other(String),
}
```

## Implementation Examples

### WebSocket Subscription Example

```rust
// Create a WebSocket manager
let mut ws_manager = WsManager::new("wss://api.hyperliquid.xyz/ws", true).await?;

// Create a channel to receive messages
let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();

// Subscribe to L2 order book data for BTC
let subscription = Subscription::L2Book { coin: "BTC".to_string() };
let subscription_id = ws_manager.add_subscription(subscription, sender).await?;

// Process incoming messages
while let Some(message) = receiver.recv().await {
    match message {
        Message::L2Book(book) => {
            println!("Received L2 book update: {:?}", book);
        }
        _ => {}
    }
}

// Unsubscribe when done
ws_manager.remove_subscription(subscription_id).await?;
```

### REST API Order Example

```rust
// Create an exchange client
let wallet = LocalWallet::from_private_key(private_key, None)?;
let exchange_client = ExchangeClient::new(None, wallet, None, None, None).await?;

// Place a limit order
let order = ClientOrderRequest {
    coin: "BTC".to_string(),
    is_buy: true,
    sz: "0.1".to_string(),
    limit_px: "50000".to_string(),
    order_type: "Limit".to_string(),
    reduce_only: false,
    cloid: Some(uuid_to_hex_string(Uuid::new_v4())),
};

let response = exchange_client.order(order, None).await?;
println!("Order response: {:?}", response);
```

### REST API Information Example

```rust
// Create an info client
let info_client = InfoClient::new(None, None).await?;

// Get user state
let user_address = H160::from_str("0x1234567890123456789012345678901234567890")?;
let user_state = info_client.user_state(user_address).await?;
println!("User state: {:?}", user_state);

// Get L2 order book for BTC
let l2_book = info_client.l2_snapshot("BTC".to_string()).await?;
println!("L2 book: {:?}", l2_book);
``` 