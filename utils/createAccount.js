const algosdk = require("algosdk");

const createAccount = async function () {
    try {
        const myAccount = algosdk.generateAccount();
        console.log("Account Address is " + myAccount.addr);

        let account_mnemonic = algosdk.secretKeyToMnemonic(myAccount.sk);
        console.log("Account Mnemonic is " + account_mnemonic);

        return myAccount;
    } catch (err) {
        console.log("err", err);
    }

    process.exit();
};

createAccount();