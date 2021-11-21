# Interact with Smart Contracts

## Application lifecycle
* The application stores the number of times it is called within its *global state* and also stores the number of times each user account calls the application within their *local state*.
* Midway through the lifecycle, the application is upgraded to add an additional key:value pair to the user's local storage for storing the call timestamp.


## Environment setup
* This guide requires two accounts:
```
// user declared account mnemonics
creatorMnemonic = "Your 25-word mnemonic goes here";
userMnemonic = "A second distinct 25-word mnemonic goes here";
```

* An `algod` client connection is also required. The following connects using Sandbox:
```
// user declared algod connection parameters
algodAddress = "http://localhost:4001";
algodToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
let algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);
```

## State storage
* Begin by defining the application's `global_schema` and `local_schema` storage requirements. 
These values are immutable once the application is created, so they must specify the maximum number required by the initial application and any future updates.
* The example application defined below may hold up to one each of `bytes` and `ints` value within the local storage of the user account, as well as a single ints value within global storage of the application:
```
// declare application state storage (immutable)
localInts = 1;
localBytes = 1;
globalInts = 1;
globalBytes = 0;
```

## Approval program
* The approval program handles the main logic of the application.


## Clear program
* This is the most basic clear program and returns true when an account clears its participation in a smart contract:
```
// declare clear state program source
clearProgramSource = `#pragma version 4
int 1
`;
```

## Application methods
### Create
* The creator will deploy the application using the create app method. It requires 7 parameters:
  - `sender`: address, representing the creator of the app
  - `sp`: suggested parameters obtained from the network
  - `on_complete`: enum value, representing NoOp
  - `approval_program`: compiled program
  - `clear program`: compiled program
  - `local_schema`: maximum local storage allocation, immutable
  - `global_schema`: maximum global storage allocation, immutable

* Use the `creator_mnemonic` to define sender:
```
// get account from mnemonic
let creatorAccount = algosdk.mnemonicToSecretKey(creatorMnemonic);
let sender = creatorAccount.addr;
```

* Use the `suggested_params` endpoint:
```
// get node suggested parameters
let params = await client.getTransactionParams().do();
// comment out the next two lines to use suggested fee
params.fee = 1000;
params.flatFee = true;
```

* Set the `on_complete` parameter to NoOp:
```
// declare onComplete as NoOp
onComplete = algosdk.OnApplicationComplete.NoOpOC;
```

* Compile the programs using the `compile` endpoint:
```
// helper function to compile program source  
async function compileProgram(client, programSource) {
    let encoder = new TextEncoder();
    let programBytes = encoder.encode(programSource);
    let compileResponse = await client.compile(programBytes).do();
    let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
    return compiledBytes;
}
```

* Construct the transaction with defined values:
```
// create unsigned transaction
let txn = algosdk.makeApplicationCreateTxn(sender, params, onComplete, 
                                        approvalProgram, clearProgram, 
                                        localInts, localBytes, globalInts, globalBytes,);
let txId = txn.txID().toString();
```

* Sign, send, await confirmation and display the results:
```
// Sign the transaction
let signedTxn = txn.signTxn(creatorAccount.sk);
console.log("Signed transaction with txID: %s", txId);

// Submit the transaction
await client.sendRawTransaction(signedTxn).do();

// Wait for confirmation
await waitForConfirmation(client, txId);

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
let appId = transactionResponse['application-index'];
console.log("Created new app-id: ",appId);
```


### Opt-in
* The user must opt-in to use the application. This method requires 3 parameters:
  - sender: address, representing the user intending to opt-in to using the app
  - sp: suggested parameters obtained from the network
  - index: the app-id as defined by the create method result

* Use the `user_mnemonic` to define sender:
```
// get accounts from mnemonic
let userAccount = algosdk.mnemonicToSecretKey(userMnemonic);
let sender = userAccount.addr;
```

* Construct the transaction with defined values:
```
// create unsigned transaction
let txn = algosdk.makeApplicationOptInTxn(sender, params, index);
```

* Sign, send, await confirmation and display the results:
```
// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
console.log("Opted-in to app-id:",transactionResponse['txn']['txn']['apid'])
```


### Call (NoOp)
* The user may now call the application. This method requires 3 parameters:
  - sender: address, representing the user intending to optin to using the app
  - sp: suggested parameters obtained from the network
  - index: the app-id as defined by the create method result

```
// create unsigned transaction
let txn = algosdk.makeApplicationNoOpTxn(sender, params, index, appArgs)

// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
console.log("Called app-id:",transactionResponse['txn']['txn']['apid'])
if (transactionResponse['global-state-delta'] !== undefined ) {
    console.log("Global State updated:",transactionResponse['global-state-delta']);
}
if (transactionResponse['local-state-delta'] !== undefined ) {
    console.log("Local State updated:",transactionResponse['local-state-delta']);
}
```


### Read state
* Anyone may read the global state of any application or the local state of an application within a given user account using the REST API `account_info` endpoint.
```
// read local state of application from user account
async function readLocalState(client, account, index){
    let accountInfoResponse = await client.accountInformation(account.addr).do();
    for (let i = 0; i < accountInfoResponse['apps-local-state'].length; i++) { 
        if (accountInfoResponse['apps-local-state'][i].id == index) {
            console.log("User's local state:");
            for (let n = 0; n < accountInfoResponse['apps-local-state'][i][`key-value`].length; n++) {
                console.log(accountInfoResponse['apps-local-state'][i][`key-value`][n]);
            }
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
        }
    }
}
```


### Update
* The creator may update the approval program using the update method (if the current approval program allows it). 
* The refactored approval program source code adds a key/value pair to the user's local storage indicating the timestamp when the application was called. 

* The update method method requires 6 parameters:
  - sender: address, representing the user intending to opt-in to using the app
  - sp: suggested parameters obtained from the network
  - index: the app-id as defined by the create method result
  - approval_program: compiled program
  - clear program: compiled program
  - app_args: application arguments used by approval program

* Construct the update transaction and await the response:
```
// create unsigned transaction
let txn = algosdk.makeApplicationUpdateTxn(sender, params, index, approvalProgram, clearProgram);

// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
let appId = transactionResponse['txn']['txn'].apid;
console.log("Updated app-id: ",appId);
```


### Call with arguments
* A program may process arguments passed at run-time. The NoOp call method has an optional `app_args` parameter where the timestamp may be supplied.
* The refactored application expects a timestamp be supplied with the application call:
```
// call application with arguments
let ts = new Date(new Date().toUTCString());
console.log(ts)
let appArgs = [];
appArgs.push(new Uint8Array(Buffer.from(ts)));

// create unsigned transaction
let txn = algosdk.makeApplicationNoOpTxn(sender, params, index, appArgs)

// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
console.log("Called app-id:",transactionResponse['txn']['txn']['apid'])
if (transactionResponse['global-state-delta'] !== undefined ) {
    console.log("Global State updated:",transactionResponse['global-state-delta']);
}
if (transactionResponse['local-state-delta'] !== undefined ) {
    console.log("Local State updated:",transactionResponse['local-state-delta']);
}
```

### Close out
* The user may discontinue use of the application by sending a close out transaction. This will remove the local state for this application from the user's account.
* This method requires 3 parameters:
  - sender: address, representing the user intending to optin to using the app
  - sp: suggested parameters obtained from the network
  - index: the app-id as defined by the create method result
```
// create unsigned transaction
let txn = algosdk.makeApplicationCloseOutTxn(sender, params, index)

// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
console.log("Closed out from app-id:",transactionResponse['txn']['txn']['apid'])
```


### Delete
* The approval program defines the creator as the only account able to delete the application. 
* This removes the global state, but does not impact any user's local state.
* This method uses the same 3 parameters:
```
// create unsigned transaction
let txn = algosdk.makeApplicationDeleteTxn(sender, params, index);

// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
let appId = transactionResponse['txn']['txn'].apid;
console.log("Deleted app-id: ",appId);
```


### Clear state
* The user may clear the local state for an application at any time, even if the application was deleted by the creator. 
* This method uses the same 3 parameter:
```
// create unsigned transaction
let txn = algosdk.makeApplicationClearStateTxn(sender, params, index);

// sign, send, await

// display results
let transactionResponse = await client.pendingTransactionInformation(txId).do();
let appId = transactionResponse['txn']['txn'].apid;
console.log("Cleared local state for app-id: ",appId);
```




























