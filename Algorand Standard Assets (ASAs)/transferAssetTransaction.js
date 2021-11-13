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

async function transferAssetTransaction() {
    try {
        // Connect to algod sandbox client and
        const algod_token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const server = "http://localhost";
        const algod_port = 4001;
        const algodClient = new algosdk.Algodv2(algod_token, server, algod_port);

        let account1_mnemonic = 'detail hazard satoshi you castle idea portion allow vault advice section emerge jump theme suit make story lizard multiply scorpion toast inch olympic absorb win';
        let account2_mnemonic = 'injury science spring lend source praise grid chimney erosion door evoke space sunset oval reunion donkey rabbit bright bronze moral win analyst combine about welcome';

        // get Account with mnemonic key
        // // https://github.com/algorand/js-algorand-sdk/blob/develop/src/mnemonic/mnemonic.ts
        let account1 = algosdk.mnemonicToSecretKey(account1_mnemonic);
        let account2 = algosdk.mnemonicToSecretKey(account2_mnemonic);

        // transfer assets from account1 to account2
        let params = await algodClient.getTransactionParams().do();
        //comment out the next two lines to use suggested fee
        params.fee = 1000;
        params.flatFee = true;

        let note = undefined;
        let from = account1.addr;
        let to = account2.addr;
        let closeRemainderTo = undefined;
        let revocationTarget = undefined;
        let amount = 20;
        let assetID = 44360640;

        let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(from, to, closeRemainderTo, revocationTarget, amount, note, assetID, params);

        let rawSignedTxn = xtxn.signTxn(account1.sk);
        let xtx = (await algodClient.sendRawTransaction(rawSignedTxn).do());

        await waitForConfirmation(algodClient, xtx.txId, 4);

        await printAssetHolding(algodClient, account2.addr, assetID);

    } catch (err) {
        console.log("err", err);
    }

    process.exit();
}

transferAssetTransaction();