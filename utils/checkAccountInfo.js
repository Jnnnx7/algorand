const algosdk = require("algosdk");

async function checkAccountInfo() {
    try {
        // Connect to algod sanbox client
        const algodToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const algodServer = 'http://localhost';
        const algodPort = 4001;
        let algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

        let addr = "4ABTUZGTFQ4PSBTIZ5CKFQTNFDB2CP6MUGDVDFCR4THBZSZBORZY5VBK3E"
        let accountInfo = await algodClient.accountInformation(addr).do();
        console.log("Account balance: %d microAlgos", accountInfo.amount);

    } catch (err) {
        console.log("err", err);
    }

    process.exit();
}

checkAccountInfo();