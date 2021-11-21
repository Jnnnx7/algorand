# Smart Contract

## Introduction

* Algorand Smart Contracts (ASC1) are small programs that serve various functions on the blockchain and operate on layer-1.
* Smart contracts are separated into two main categories, **smart contracts**, and **smart signatures**. 
The type of contract that is written will determine when and how the logic of the program is evaluated.

### Smart contracts

* Smart contracts are contracts that once deployed are remotely callable from any node in the Algorand blockchain.
* These contracts are triggered by a specific type of transaction called an **application transaction**.
* These contracts typically handle the primary decentralized logic of a dApp and can modify data associated with the contract on a global basis or a per-user basis.
This data is referred to either as **global or local state**. When an application transaction is processed these state variables can be modified by the contract.
* Smart contracts can create and execute many different types of Algorand transactions as part of the execution of the logic.
* Smart contracts can also hold Algos or ASAs balances and can be used as on-chain escrow accounts.
* Smart contracts have access to many on-chain values, such as balance lookups, asset configurations, and the latest block time.

### Smart signatures
* Smart signatures contain logic that is used to sign transactions, primarily for signature delegation.
* The logic of the smart signature is submitted with a transaction. 
* While the logic in the smart signature is stored on the chain as part of resolving the transaction, the logic is not remotely callable.
 Any new transaction that relies on the same smart signature would resubmit the logic.
* When the logic is submitted to a node the AVM evaluates the logic, where it either fails or succeeds. 
If a smart signature’s logic fails when executed by the AVM, the associated transaction will not be executed.

* Smart signatures can be used in two different modes.
* When compiled smart signatures produce an Algorand account that functions similar to any other account on the blockchain.
These accounts can hold Algos or assets. 
These funds are only allowed to leave the account if a transaction occurs from the account that successfully executes the logic within the smart signature.
* Smart signatures can also also be used to delegate some portion of authority to another account. 
In this case, an account can sign the smart signature which can then be used at a later time to sign a transaction from the original signer’s account. This is referred to as account delegation.

* Once a transaction that is signed with a smart signature, is submitted it is evaluated by an Algorand node using the Alogrand Virtual Machine.
These contracts only have access to a few global variables, some temporary scratch space, and the properties of the transaction(s) they are submitted with.
