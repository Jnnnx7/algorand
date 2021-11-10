const algosdk = require("algosdk");
const keypress = async () => {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        resolve()
    })) 
}

// Function used to print asset holding for account and assetid
const printAssetHolding = async function (algodclient, account, assetid) {
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


const waitForConfirmation = async function (algodClient, txId, timeout) {
    if (algodClient == null || txId == null || timeout < 0) {
        throw new Error("Bad arguments");
    }

    const status = (await algodClient.status().do());
    if (status === undefined) {
        throw new Error("Unable to get node status");
    }

    const startround = status["last-round"] + 1;
    let currentround = startround;

    while (currentround < (startround + timeout)) {
        const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
        if (pendingInfo !== undefined) {
            if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
                //Got the completed Transaction
                return pendingInfo;
            } else {
                if (pendingInfo["pool-error"] != null && pendingInfo["pool-error"].length > 0) {
                    // If there was a pool error, then the transaction has been rejected!
                    throw new Error("Transaction " + txId + " rejected - pool error: " + pendingInfo["pool-error"]);
                }
            }
        }

        await algodClient.statusAfterBlock(currentround).do();
        currentround++;
    }

    throw new Error("Transaction " + txId + " not confirmed after " + timeout + " rounds!");
};

async function assetsTransaction() {
    try {
        // Connect to algod sandbox client and indexer
        const algod_token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const server = "http://localhost";
        const algod_port = 4001;
        const algodClient = new algosdk.Algodv2(algod_token, server, algod_port);
        
        // create two accounts
        // https://github.com/algorand/js-algorand-sdk/blob/develop/src/types/account.ts
        let account1 = algosdk.generateAccount();
        let account1_mnemonic = algosdk.secretKeyToMnemonic(account1.sk);
        console.log("Account Address is " + account1.addr);
        console.log("Account Mnemonic is " + account1_mnemonic);
        // fund account at: https://dispenser.testnet.aws.algodev.network/
        console.log("Press any key when the account is funded");
        await keypress();

        let account2 = algosdk.generateAccount();
        let account2_mnemonic = algosdk.secretKeyToMnemonic(account2.sk)
        console.log("Account Address is " + account2.addr);
        console.log("Account Mnemonic is " + account2_mnemonic);
        console.log("Press any key when the account is funded");
        await keypress();

        // get Account with mnemonic key
        // // https://github.com/algorand/js-algorand-sdk/blob/develop/src/mnemonic/mnemonic.ts
        // let recovered_account1 = algosdk.mnemonicToSecretKey(account1_mnemonic);
        // let recovered_account2 = algosdk.mnemonicToSecretKey(account2_mnemonic);

        // account1 creates Asset for itself
        let params = await algodClient.getTransactionParams().do();
        params.fee = 1000;
        params.flatFee = true;

        // set Asset parameters
        // https://github.com/algorand/js-algorand-sdk/blob/develop/src/makeTxn.ts#L378
        // string representation of Algorand address of sender
        // manager: string representation of Algorand address in charge of reserve, freeze, clawback, destruction, etc
        // reserve: string representation of Algorand address representing asset reserve
        // clawback: string representation of Algorand address with power to revoke asset holdings
        let addr1 = account1.addr;
        // uint8array of arbitrary data for sender to store
        let note = undefined;
        // integer total supply of the asset
        let total = 100;
        // integer number of decimals for asset unit calculation
        let decimals = 0;
        // boolean whether asset accounts should default to being frozen
        let defaultFrozen = false;
        // string units name for this asset
        let unitName = "coin";
        // string name for this asset
        let assetName = "Space Coins";

        // sign and send "txn" allows "addr" to create an asset
        let txn = algosdk.makeAssetCreateTxnWithSuggestedParams(addr1, note,
            total, decimals, defaultFrozen, addr1, addr1, addr1, addr1,
            unitName, assetName, "", "", params);

        let rawSignedTxn = txn.signTxn(account1.sk);
        let tx = (await algodClient.sendRawTransaction(rawSignedTxn).do());

        // wait for transaction to be confirmed
        await waitForConfirmation(algodClient, tx.txId, 4);

        // Get the new asset's information from the creator account
        let ptx = await algodClient.pendingTransactionInformation(tx.txId).do();
        let assetID = ptx["asset-index"];
        
        await printAssetHolding(algodClient, account1.addr, assetID);


        /* ============================================================ */


        // Before an account can receive a specific asset it must opt-in to receive it.
        // An opt-in transaction is simply an asset transfer with an amount of 0
        // opt in account2 to transact with the new asset
        params = await algodClient.getTransactionParams().do();
        params.fee = 1000;
        params.flatFee = true;


        // https://github.com/algorand/js-algorand-sdk/blob/develop/src/makeTxn.ts#L937
        // from: string representation of Algorand address of sender
        // to: string representation of Algorand address of asset recipient
        // sender and recipient are the same
        let addr2 = account2.addr;
        // closeRemainderTo: send all remaining assets after transfer to the "closeRemainderTo" address and close "from"'s asset holdings
        // not close out the asset
        let closeRemainderTo = undefined;
        // revocationTarget: if "from" is the asset's revocation manager, then deduct from "revocationTarget" rather than "from"
        // not a clawback operation
        let revocationTarget = undefined;
        // integer amount of assets to send
        amount = 0;

        // sign and send "txn" allows sender to begin accepting asset specified by creator and index
        let opttxn = algosdk.makeAssetTransferTxnWithSuggestedParams(addr2, addr2, closeRemainderTo, revocationTarget, amount, note, assetID, params);

        rawSignedTxn = opttxn.signTxn(account2.sk);
        let opttx = (await algodClient.sendRawTransaction(rawSignedTxn).do());

        // wait for transaction to be confirmed
        await waitForConfirmation(algodClient, opttx.txId, 4);

        // should now see the new asset listed in the account information
        await printAssetHolding(algodClient, account2.addr, assetID);


        /* ============================================================ */


        // transfer assets from account1 to account3
    } catch (err) {
        console.log("err", err);
    }

    process.exit();
}

assetsTransaction();