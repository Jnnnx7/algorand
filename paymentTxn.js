const algosdk = require("algosdk");
const keypress = async () => {
    process.stdin.setRawMode(true)
    return new Promise(resolve => process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        resolve()
    })) 
}

const createAccount = function () {
    try {
        const myAccount = algosdk.generateAccount();
        console.log("Account Address = " + myAccount.addr);

        let account_mnemonic = algosdk.secretKeyToMnemonic(myAccount.sk);
        console.log("Account Mnemonic = " + account_mnemonic);

        return myAccount;
    } catch (err) {
        console.log("err", err);
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

async function paymentTransaction() {
    try {
        // Connect to algod sanbox client
        const algodToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const algodServer = 'http://localhost';
        const algodPort = 4001;
        let algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

        let account1 = createAccount();
        console.log("Press any key when the account is funded");
        await keypress();

        //Check your balance
        let accountInfo = await algodClient.accountInformation(account1.addr).do();
        console.log("Account 1 balance: %d microAlgos", accountInfo.amount);

        let account2 = createAccount();
        console.log("Press any key when the account is funded");
        await keypress();

        //Check your balance
        accountInfo = await algodClient.accountInformation(account2.addr).do();
        console.log("Account 2 balance: %d microAlgos", accountInfo.amount);

        // Construct the transaction
        let params = await algodClient.getTransactionParams().do();
        params.fee = 1000;
        params.flatFee = true;

        let sender = account1.addr;
        const receiver = account2.addr;
        const note = new TextEncoder().encode("Send Algos");
        let amount = 1000000;
        let txn = algosdk.makePaymentTxnWithSuggestedParams(sender, receiver, amount, undefined, note, params);

        // Sign the transaction
        let signedTxn = txn.signTxn(account1.sk);
        let txId = txn.txID().toString();
        console.log("Signed transaction with txID: %s", txId);

        // Submit the transaction
        await algodClient.sendRawTransaction(signedTxn).do();

        // Wait for confirmation
        let confirmedTxn = await waitForConfirmation(algodClient, txId, 4);
        //Get the completed Transaction
        console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
        var string = new TextDecoder().decode(confirmedTxn.txn.txn.note);
        console.log("Note field: ", string);

        //Check your balance
        accountInfo = await algodClient.accountInformation(account1.addr).do();
        console.log("Account 1 balance: %d microAlgos", accountInfo.amount);

        accountInfo = await algodClient.accountInformation(account2.addr).do();
        console.log("Account 2 balance: %d microAlgos", accountInfo.amount);
    } catch (err) {
        console.log("err", err);
    }

    process.exit();
}

paymentTransaction();