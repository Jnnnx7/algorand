# Algorand Standard Assets (ASAs)

* **Algorand Standard Assets (ASA)** are on-chain assets that benefit from the same security, compatibility, speed and ease of use as the Algo.

## Assets overview
* A single Algorand account is permitted to create up to 1000 assets.
* For every asset an account creates or owns, its minimum balance is increased by 0.1 Algos (100,000 microAlgos).
* Before a new asset can be transferred to a specific account the receiver must opt-in to receive the asset.
* If any transaction is issued that would violate the maximum number of assets for an account or not meet the minimum balance requirements, the transaction will fail.


## Asset parameters
* The type of asset that is created will depend on the parameters that are passed during asset creation and sometimes during asset re-configuration.

### Immutable asset parameters
* **Creator** (required)
* **AssetName** (optional, but recommended)
* **UnitName** (optional, but recommended): The name of a unit of this asset. Supplied on creation. Max size is 8 bytes.
* **Total** (required)
* **Decimals** (required): The number of digits to use after the decimal point when displaying the asset. If 0, the asset is not divisible. If 1, the base unit of the asset is in tenths. If 2, the base unit of the asset is in hundredths.
* **DefaultFrozen** (required): True to freeze holdings for this asset by default.
* **URL** (optional): Specifies a URL where more information about the asset can be retrieved. Max size is 32 bytes.
* **MetaDataHash** (optional): This field is intended to be a 32-byte hash of some metadata that is relevant to your asset and/or asset holders. The format of this metadata is up to the application. This field can only be specified upon creation.


### Mutable asset parameters
There are four parameters that correspond to addresses that can authorize specific functionality for an asset. 
These addresses must be specified on creation but they can also be modified after creation.
These addresses can be set as empty strings, which will irrevocably lock the function that they would have had authority over.

* **Manager Address**: 

The address of the account that can manage the configuration of the asset and destroy it.
The manager account is the only account that can authorize transactions to re-configure or destroy an asset.

* **Reserve Address**:

The address of the account that holds the reserve (non-minted) units of the asset. 
This address has no specific authority in the protocol itself. 
It is used in the case where you want to signal to holders of your asset that the non-minted units of the asset reside in an account that is different from the default creator account (the sender).

Specifying a reserve account signifies that non-minted assets will reside in that account instead of the default creator account.
Assets transferred from this account are "minted" units of the asset.
If you specify a new reserve address, you must make sure the new account has opted into the asset and then issue a transaction to transfer all assets to the new reserve.

* **Freeze Address**:

The address of the account used to freeze holdings of this asset. If empty, freezing is not permitted.

When an account is frozen it cannot send or receive the frozen asset. 
If the DefaultFrozen state is set to True, you can use the unfreeze action to authorize certain accounts to trade the asset (such as after passing KYC/AML checks).

* **Clawback Address**

The address of the account that can clawback holdings of this asset. If empty, clawback is not permitted.

The clawback address represents an account that is allowed to transfer assets from and to any asset holder (assuming they have opted-in). 
Use this if you need the option to revoke assets from an account (like if they breach certain contractual obligations tied to holding the asset). 


## Asset functions
### Creating an asset
* Transaction Authorizer: Any account with sufficient Algo balance.
```
    let note = undefined; // arbitrary data to be stored in the transaction; here, none is stored
    // Asset creation specific parameters
    // The following parameters are asset specific
    // Throughout the example these will be re-used. 
    // We will also change the manager later in the example
    let addr = recoveredAccount1.addr;
    // Whether user accounts will need to be unfrozen before transacting    
    let defaultFrozen = false;
    // integer number of decimals for asset unit calculation
    let decimals = 0;
    // total number of this asset available for circulation   
    let totalIssuance = 1000;
    // Used to display asset units to user    
    let unitName = "LATINUM";
    // Friendly name of the asset    
    let assetName = "latinum";
    // Optional string pointing to a URL relating to the asset
    let assetURL = "http://someurl";
    // Optional hash commitment of some sort relating to the asset. 96 character length.
    let assetMetadataHash = "16efaa3924a6fd9d3a4824799a4ac65d";
    // The following parameters are the only ones
    // that can be changed, and they have to be changed
    // by the current manager
    // Specified address can change reserve, freeze, clawback, and manager
    let manager = recoveredAccount2.addr;
    // Specified address is considered the asset reserve
    // (it has no special privileges, this is only informational)
    let reserve = recoveredAccount2.addr;
    // Specified address can freeze or unfreeze user asset holdings 
    let freeze = recoveredAccount2.addr;
    // Specified address can revoke user asset holdings and send 
    // them to other addresses    
    let clawback = recoveredAccount2.addr;

    // signing and sending "txn" allows "addr" to create an asset
    let txn = algosdk.makeAssetCreateTxnWithSuggestedParams(addr, note,
            totalIssuance, decimals, defaultFrozen, manager, reserve, freeze,
        clawback, unitName, assetName, assetURL, assetMetadataHash, params);

    let rawSignedTxn = txn.signTxn(recoveredAccount1.sk)
    let tx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
    console.log("Transaction : " + tx.txId);
    let assetID = null;
    // wait for transaction to be confirmed
    await waitForConfirmation(algodclient, tx.txId);
    // Get the new asset's information from the creator account
    let ptx = await algodclient.pendingTransactionInformation(tx.txId).do();
    assetID = ptx["asset-index"];
```


### Modifying an asset
* Authorized by: Asset Manager Account

* After an asset has been created only the manager, reserve, freeze and clawback accounts can be changed. 
All other parameters are locked for the life of the asset.
* Only the manager account can make configuration changes and must authorize the transaction.

```
// Asset configuration specific parameters
// all other values are the same so we leave 
// Them set.
// specified address can change reserve, freeze, clawback, and manager
manager = recoveredAccount1.addr;
// Note that the change has to come from the existing manager
let ctxn = algosdk.makeAssetConfigTxnWithSuggestedParams(recoveredAccount2.addr, note, 
    assetID, manager, reserve, freeze, clawback, params);
// This transaction must be signed by the current manager
rawSignedTxn = ctxn.signTxn(recoveredAccount2.sk)
let ctx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
console.log("Transaction : " + ctx.txId);
// wait for transaction to be confirmed
await waitForConfirmation(algodclient, ctx.txId);
// Get the asset information for the newly changed asset
// use indexer or utiltiy function for Account info
// The manager should now be the same as the creator
await printCreatedAsset(algodclient, recoveredAccount1.addr, assetID);
```


### Receiving an asset
* Authorized by: The account opting in
* Before an account can receive a specific asset it must opt-in to receive it. 
* An opt-in transaction places an asset holding of 0 into the account and increases its minimum balance by 100,000 microAlgos.
* An opt-in transaction is simply an asset transfer with an amount of 0, both to and from the account opting in.

```
// Opting in to transact with the new asset
// Allow accounts that want recieve the new asset
// Have to opt in. To do this they send an asset transfer
// of the new asset to themseleves 
// In this example we are setting up the 3rd recovered account to 
// receive the new asset
let sender = recoveredAccount3.addr;
let recipient = sender;
// We set revocationTarget to undefined as 
// This is not a clawback operation
let revocationTarget = undefined;
// CloseReaminerTo is set to undefined as
// we are not closing out an asset
let closeRemainderTo = undefined;
// We are sending 0 assets
amount = 0;
// signing and sending "txn" allows sender to begin accepting asset specified by creator and index
let opttxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget,
        amount, note, assetID, params);
// Must be signed by the account wishing to opt in to the asset    
rawSignedTxn = opttxn.signTxn(recoveredAccount3.sk);
let opttx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
console.log("Transaction : " + opttx.txId);
// wait for transaction to be confirmed
await waitForConfirmation(algodclient, opttx.txId);
//You should now see the new asset listed in the account information
console.log("Account 3 = " + recoveredAccount3.addr);
await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);
```


### Transferring an asset
* Authorized by: The account that holds the asset to be transferred.

* Assets can be transferred between accounts that have opted-in to receiving the asset.

```
// Transfer New Asset:
// Now that account3 can recieve the new tokens 
// we can tranfer tokens in from the creator
// to account3
sender = recoveredAccount1.addr;
recipient = recoveredAccount3.addr;
revocationTarget = undefined;
closeRemainderTo = undefined;
//Amount of the asset to transfer
amount = 10;

// signing and sending "txn" will send "amount" assets from "sender" to "recipient"
let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget,
        amount,  note, assetID, params);
// Must be signed by the account sending the asset  
rawSignedTxn = xtxn.signTxn(recoveredAccount1.sk)
let xtx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
console.log("Transaction : " + xtx.txId);
// wait for transaction to be confirmed
await waitForConfirmation(algodclient, xtx.txId);

// You should now see the 10 assets listed in the account information
console.log("Account 3 = " + recoveredAccount3.addr);
await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);
```


### Freezing an asset
* Authorized by: Asset Freeze Address

* Freezing or unfreezing an asset for an account requires a transaction that is signed by the freeze account.

```
// The asset was created and configured to allow freezing an account
// If the freeze address is set "", it will no longer be possible to do this.
// In this example we will now freeze account3 from transacting with the 
// The newly created asset. 
// The freeze transaction is sent from the freeze acount
// Which in this example is account2 
from = recoveredAccount2.addr;
freezeTarget = recoveredAccount3.addr;
freezeState = true;

// The freeze transaction needs to be signed by the freeze account
let ftxn = algosdk.makeAssetFreezeTxnWithSuggestedParams(from, note,
    assetID, freezeTarget, freezeState, params)

// Must be signed by the freeze account   
rawSignedTxn = ftxn.signTxn(recoveredAccount2.sk)
let ftx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
console.log("Transaction : " + ftx.txId);
// wait for transaction to be confirmed
await waitForConfirmation(algodclient, ftx.txId);

// You should now see the asset is frozen listed in the account information
console.log("Account 3 = " + recoveredAccount3.addr);
await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);
```


### Revoking an asset
* Authorized by: Asset Clawback Address

* Revoking an asset for an account removes a specific number of the asset from the revoke target account.
* Revoking an asset from an account requires specifying an asset sender (the revoke target account) and an asset receiver (the account to transfer the funds back to).

```
    // The asset was also created with the ability for it to be revoked by 
    // the clawbackaddress. If the asset was created or configured by the manager
    // to not allow this by setting the clawbackaddress to "" then this would 
    // not be possible.
    // We will now clawback the 10 assets in account3. account2
    // is the clawbackaccount and must sign the transaction
    // The sender will be be the clawback adress.
    // the recipient will also be be the creator in this case
    // that is account3
    sender = recoveredAccount2.addr;
    recipient = recoveredAccount1.addr;
    revocationTarget = recoveredAccount3.addr;
    closeRemainderTo = undefined;
    amount = 10;
    // signing and sending "txn" will send "amount" assets from "revocationTarget" to "recipient",
    // if and only if sender == clawback manager for this asset

    let rtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget,
    amount, note, assetID, params);
    // Must be signed by the account that is the clawback address    
    rawSignedTxn = rtxn.signTxn(recoveredAccount2.sk)
    let rtx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
    console.log("Transaction : " + rtx.txId);
    // wait for transaction to be confirmed
    await waitForConfirmation(algodclient, rtx.txId);

    // You should now see 0 assets listed in the account information
    // for the third account
    console.log("Account 3 = " + recoveredAccount3.addr);
    await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);
```


### Destroying an asset
* Authorized by: Asset Manager

* Created assets can be destroyed only by the asset manager account. 
* All of the assets must be owned by the creator of the asset before the asset can be deleted.

```
// All of the created assets should now be back in the creators
// Account so we can delete the asset.
// If this is not the case the asset deletion will fail
// The address for the from field must be the manager account
// Which is currently the creator addr1
addr = recoveredAccount1.addr;
note = undefined;
// if all assets are held by the asset creator,
// the asset creator can sign and issue "txn" to remove the asset from the ledger. 
let dtxn = algosdk.makeAssetDestroyTxnWithSuggestedParams(addr, note, assetID, params);
// The transaction must be signed by the manager which 
// is currently set to account1
rawSignedTxn = dtxn.signTxn(recoveredAccount1.sk)
let dtx = (await algodclient.sendRawTransaction(rawSignedTxn).do());
console.log("Transaction : " + dtx.txId);
// wait for transaction to be confirmed
await waitForConfirmation(algodclient, dtx.txId);

// The account3 and account1 should no longer contain the asset as it has been destroyed
console.log("Asset ID: " + assetID);
console.log("Account 1 = " + recoveredAccount1.addr);
await printCreatedAsset(algodclient, recoveredAccount1.addr, assetID);
await printAssetHolding(algodclient, recoveredAccount1.addr, assetID);
console.log("Account 3 = " + recoveredAccount3.addr);
await printAssetHolding(algodclient, recoveredAccount3.addr, assetID); 
```


## Retrieve asset information
```
// Function used to print created asset for account and assetid
const printCreatedAsset = async function (algodclient, account, assetid) {
    // note: if you have an indexer instance available it is easier to just search accounts for an asset
    let accountInfo = await algodclient.accountInformation(account).do();
    for (idx = 0; idx < accountInfo['created-assets'].length; idx++) {
        let scrutinizedAsset = accountInfo['created-assets'][idx];
        if (scrutinizedAsset['index'] == assetid) {
            console.log("AssetID = " + scrutinizedAsset['index']);
            let myparms = JSON.stringify(scrutinizedAsset['params'], undefined, 2);
            console.log("parms = " + myparms);
            break;
        }
    }
};
// Function used to print asset holding for account and assetid
const printAssetHolding = async function (algodclient, account, assetid) {
    // note: if you have an indexer instance available it is easier to just search accounts for an asset
    let accountInfo = await algodclient.accountInformation(account).do();
    for (idx = 0; idx < accountInfo['assets'].length; idx++) {
        let scrutinizedAsset = accountInfo['assets'][idx];
        if (scrutinizedAsset['asset-id'] == assetid) {
            let myassetholding = JSON.stringify(scrutinizedAsset, undefined, 2);
            console.log("assetholdinginfo = " + myassetholding);
            break;
        }
    }
};
...
    await printCreatedAsset(algodclient, recoveredAccount1.addr, assetID);
    await printAssetHolding(algodclient, recoveredAccount1.addr, assetID);
```

*(full code: https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js)*

























