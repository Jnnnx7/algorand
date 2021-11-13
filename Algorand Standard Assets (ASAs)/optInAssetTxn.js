const algosdk = require("algosdk");

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

async function optInAssetTransaction() {
    try {
        // Connect to algod sandbox client and
        const algod_token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const server = "http://localhost";
        const algod_port = 4001;
        const algodClient = new algosdk.Algodv2(algod_token, server, algod_port);

        let account2_mnemonic = 'injury science spring lend source praise grid chimney erosion door evoke space sunset oval reunion donkey rabbit bright bronze moral win analyst combine about welcome';

        // get Account with mnemonic key
        let account2 = algosdk.mnemonicToSecretKey(account2_mnemonic);

        // Before an account can receive a specific asset it must opt-in to receive it.
        // An opt-in transaction is simply an asset transfer with an amount of 0
        // opt in account2 to transact with the new asset
        let params = await algodClient.getTransactionParams().do();
        params.fee = 1000;
        params.flatFee = true;

        // https://github.com/algorand/js-algorand-sdk/blob/develop/src/makeTxn.ts#L937
        // from: string representation of Algorand address of sender
        // to: string representation of Algorand address of asset recipient
        // sender and recipient are the same
        let addr2 = account2.addr;
        // uint8array of arbitrary data for sender to store
        let note = undefined;
        // closeRemainderTo: send all remaining assets after transfer to the "closeRemainderTo" address and close "from"'s asset holdings
        // not close out the asset
        let closeRemainderTo = undefined;
        // revocationTarget: if "from" is the asset's revocation manager, then deduct from "revocationTarget" rather than "from"
        // not a clawback operation
        let revocationTarget = undefined;
        // integer amount of assets to send
        let amount = 0;
        let assetID = 44360640;

        // sign and send "txn" allows sender to begin accepting asset specified by creator and index
        let opttxn = algosdk.makeAssetTransferTxnWithSuggestedParams(addr2, addr2, closeRemainderTo, revocationTarget, amount, note, assetID, params);

        let rawSignedTxn = opttxn.signTxn(account2.sk);
        let opttx = (await algodClient.sendRawTransaction(rawSignedTxn).do());

        // wait for transaction to be confirmed
        await waitForConfirmation(algodClient, opttx.txId, 4);

        // should now see the new asset listed in the account information
        await printAssetHolding(algodClient, account2.addr, assetID);

    } catch (err) {
        console.log("err", err);
    }

    process.exit();
}

optInAssetTransaction();