const algosdk = require('algosdk');

// read local state of application from user account
async function readLocalState(client, account, index){
    let accountInfoResponse = await client.accountInformation(account.addr).do();
    for (let i = 0; i < accountInfoResponse['apps-local-state'].length; i++) { 
        if (accountInfoResponse['apps-local-state'][i].id == index) {
            console.log("User's local state:");
            for (let n = 0; n < accountInfoResponse['apps-local-state'][i][`key-value`].length; n++) {
                console.log(accountInfoResponse['apps-local-state'][i][`key-value`][n]);
            }
            
            break;
        }
    }
}

// read global state of application
async function readGlobalState(client, account, index){
    let accountInfoResponse = await client.accountInformation(account.addr).do();
    for (let i = 0; i < accountInfoResponse['created-apps'].length; i++) { 
        if (accountInfoResponse['created-apps'][i].id == index) {
            console.log("Application's global state:");
            for (let n = 0; n < accountInfoResponse['created-apps'][i]['params']['global-state'].length; n++) {
                console.log(accountInfoResponse['created-apps'][i]['params']['global-state'][n]);
            }

            break;
        }
    }
}

async function main() {
    try {
         // connect to sandbox client
        const algodServer = "http://localhost";
        const algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const algodPort = 4001;
        const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

        // get the creator account 
        const creatorMnemonic = "already chalk result film time like kiss rib course artwork shy fiscal enrich wrong artefact mansion slam electric gorilla response mother gorilla bottom absorb tube";
        let creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);

        // get user account
        const userMnemonic = "bring hockey blanket leisure object marriage siege make future gate prevent later teach solution say stick pave term manage library army note flavor absorb tone";
        let userAccount = algosdk.mnemonicToSecretKey(userMnemonic);

        const appId = 46501612;

        // read local state of application from user account
        await readLocalState(algodClient, userAccount, appId);

        // read global state of application
        await readGlobalState(algodClient, creatorAccount, appId);
        
    } catch (err) {
        console.log("err", err);  
    }
}

main();