# Modes of Use

* Smart signatures have two basic usage scenarios: as a `contract account` or as a `delegated signature`.


## Logic signatures
* `Logic Signatures`, referenced as `LogicSig`, are structures that contain the following four parts:
  - `Logic`: Raw Program Bytes (Required)
  - `Sig`: Signature of Program Bytes (Optional)
  - `MSig`: Multi-Signature of Program Bytes (Optional)
  - `Args`: Array of Bytes Strings Passed to the Program (Optional)

* Before a LogicSig can be used with a transaction, it first must be a valid Logic Signature. 
* The LogicSig is considered valid if one of the following scenarios is true:
  - Sig contains a valid Signature of the program from the account that is sending the Transaction.
  - Msig contains a valid Multi-Signature of the program from the Multi-Signature account sending the Transaction.
  - The hash of the program is equal to the Sender's Address.

* The first two cases are examples of delegation. An account owner can declare that on their behalf the signed logic can authorize transactions.
* The third case is an account wholly governed by the program. The program cannot be changed. 
Once Algos or assets have been sent to that account, Algos or assets only leave when there is a transaction that approves it.


## Contract account
* For each unique compiled smart signature program there exists a single corresponding Algorand address, output by `goal clerk compile`.
* To use a TEAL program as a contract account, send Algos to its address to turn it into an account on Algorand with a balance. 
Outwardly, this account looks no different from any other Algorand account and anyone can send it Algos or Algorand Standard Assets to increase its balance.
* The account differs in how it authenticates spends from it, in that the logic determines if the transaction is approved. 
To spend from a contract account, create a transaction that will evaluate to True against the TEAL logic, then add the compiled TEAL code as its logic signature.
* It is worth noting that anyone can create and submit the transaction that spends from a contract account as long as they have the compiled TEAL contract to add as a logic signature.

![image](https://user-images.githubusercontent.com/50033248/139769948-ec15ed1a-17b7-4c20-863a-c6f03f0639a2.png)


## Delegated approval
* Smart signatures can also be used to delegate signature authority, which means that a private key can sign a TEAL program and the resulting output can be used as a signature in transactions on behalf of the account associated with the private key.
* The owner of the delegated account can share this logic signature, allowing anyone to spend funds from his or her account according to the logic within the TEAL program.
* The logic signature can be produced from either a single or multi-signature account.

![image](https://user-images.githubusercontent.com/50033248/139770746-5d6ddd50-0548-4d91-a40c-bd54e1b89f46.png)

















