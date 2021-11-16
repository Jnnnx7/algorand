# Transaction Execution Approval Language (TEAL)

- TEAL is a bytecode based stack language that executes inside Algorand transactions.
- TEAL programs can be used to check the parameters of the transaction and approve the transaction as if by a signature. This use of TEAL is called a **LogicSig**.
- Starting with v2, TEAL programs may also execute as **Applications** which are invoked with explicit application call transactions.
- Programs have read-only access to the transaction they are attached to, transactions in their atomic transaction group, and a few global values.
- Application programs have access to limited state that is global to the application and per-account local state for each account that has opted-in to the application.
- For both types of program, approval is signaled by finishing with the stack containing a single non-zero uint64 value.


## The Stack

- The stack starts empty and contains values of either uint64 or bytes (bytes are implemented in Go as a byte slice and may not exceed 4096 bytes in length).
- Most operations act on the stack, popping arguments from it and pushing results to it.
- The maximum stack depth is currently 1000.


## Scratch Space

- In addition to the stack there are 256 positions of scratch space, also uint64-bytes union values, each initialized as uint64 zero.
- Scratch space is acccesed by the `load(s)` and `store(s)` ops moving data from or to scratch space, respectively.


## Execution Modes
- Starting from version 2 TEAL evaluator can run programs in two modes: 1. LogicSig (stateless) 2. Application run (stateful).
- Differences between modes include:
  - 1. Max program length (consensus parameters LogicSigMaxSize, MaxAppTotalProgramLen & MaxExtraAppProgramPages)
  - 2. Max program cost (consensus parameters LogicSigMaxCost, MaxAppProgramCost)
  - 3. Opcode availability.


## Execution Environment for LogicSigs
- TEAL LogicSigs run in Algorand nodes as part of testing a proposed transaction to see if it is valid and authorized to be committed into a block.

- If an authorized program executes and finishes with a single non-zero uint64 value on the stack, then that program has validated the transaction it is attached to.

- The TEAL program has access to data from the transaction it is attached to (`txn` op), any transactions in a transaction group it is part of (`gtxn` op), and a few global values like consensus parameters (`global` op).
- Some "Args" may be attached to a transaction being validated by a TEAL program. Args are an array of byte strings.
- A common pattern would be to have the key to unlock some contract as an Arg. 
- Args are recorded on the blockchain and publicly visible when the transaction is submitted to the network. 
- These *LogicSig Args* are not signed.

- A program can either authorize some delegated action on a normal private key signed or multisig account or be wholly in charge of a contract account.
  - If the account has signed the program (an ed25519 signature on "Program" concatenated with the program bytes), then if the program returns true, the transaction is authorized as if the account had signed it.
    This allows an account to hand out a signed program so that other users can carry out delegated actions which are approved by the program.
  - If the SHA512_256 hash of the program (prefixed by "Program") is equal to the transaction Sender address then this is a contract account wholly controlled by the program.
    No other signature is necessary or possible. The only way to execute a transaction against the contract account is for the program to approve it.

- The TEAL bytecode plus the length of all Args must add up to no more than 1000 bytes (consensus parameter LogicSigMaxSize).
- Each TEAL op has an associated cost and the program cost must total no more than 20000 (consensus parameter LogicSigMaxCost). Most ops have a cost of 1, but a few slow crypto ops are much higher.
- Beginning with v4, the program's cost is tracked dynamically, while being evaluated. If the program exceeds its budget, it fails.


## Constants

- Constants are loaded into the environment into storage separate from the stack. 
- They can then be pushed onto the stack by referring to the type and index.
- This makes for efficient re-use of byte constants used for account addresses, etc. 
- Constants that are not reused can be pushed with `pushint` or `pushbytes`.

- The assembler will hide most of this, allowing simple use of `int 1234` and `byte 0xcafed00d`. 
- These constants will automatically get assembled into int and byte pages of constants, de-duplicated, and operations to load them from constant storage space inserted.

- Constants are loaded into the environment by two opcodes, `intcblock` and `bytecblock`.
- The `intcblock` opcode is followed by a varuint specifying the length of the array and then that number of varuint.
- The `bytecblock` opcode is followed by a varuint array length then that number of pairs of (varuint, bytes) length prefixed byte strings.
- This should efficiently load 32 and 64 byte constants which will be common as addresses, hashes, and signatures.

- Constants are pushed onto the stack by `intc`, `intc_[0123]`, `pushint`, `bytec`, `bytec_[0123]`, and `pushbytes`.
- The assembler will handle converting `int N` or `byte N` into the appropriate form of the instruction needed.


### Named Integer Constants

#### ONCOMPLETE

- An application transaction must indicate the action to be taken following the execution of its approvalProgram or clearStateProgram.
- The constants below describe the available actions:

| Value | Constant name     | Description                                                                                                                                                                                                                             |
|:-----:|:-----------------:|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
| 0     | NoOp              | Only execute the `ApprovalProgram` associated with this application ID, with no additional effects.                                                                                                                                     |
| 1     | OptIn             | Before executing the `ApprovalProgram`, allocate local state for this application into the sender's account data.                                                                                                                       |
| 2     | CloseOut          | After executing the `ApprovalProgram`, clear any local state for this application out of the sender's account data.                                                                                                                     |
| 3     | ClearState        | Don't execute the `ApprovalProgram`, and instead execute the `ClearStateProgram` (which may not reject this transaction). Additionally, clear any local state for this application out of the sender's account data as in `CloseOutOC`. |
| 4     | UpdateApplication | After executing the `ApprovalProgram`, replace the `ApprovalProgram` and `ClearStateProgram` associated with this application ID with the programs specified in this transaction.                                                       |
| 5     | DeleteApplication | After executing the `ApprovalProgram`, delete the application parameters from the account data of the application's creator.                                                                                                            |


#### TYPEENUM CONSTANTS

| value | Constant name | Description                       |
|:-----:|:-------------:|:---------------------------------:|
| 0     | unknown       | Unknown type. Invalid transaction |
| 1     | pay           | Payment                           |
| 2     | keyreg        | KeyRegistration                   |
| 3     | acfg          | AssetConfig                       |
| 4     | axfer         | AssetTransfer                     |
| 5     | afrz          | AssetFreeze                       |
| 6     | appl          | ApplicationCall                   |


## Operations

- Most operations work with only one type of argument, uint64 or bytes, and panic if the wrong type value is on the stack.

- Many instructions accept values to designate Accounts, Assets, or Applications.
- These values may always be given as an offset in the corresponding Txn fields (Txn.Accounts, Txn.ForeignAssets, Txn.ForeignApps) or as the value itself (a bytes address for Accounts, or a uint64 ID). The values, however, must still be present in the Txn fields.
- In the case of account offsets or application offsets, 0 is specially defined to Txn.Sender or the ID of the current application, respectively.

- The instruction set has some optimization built in.
- `intc`, `bytec`, and `arg` take an immediate value byte, making a 2-byte op to load a value onto the stack, but they also have single byte versions for loading the most common constant values.
- Any program will benefit from having a few common values loaded with a smaller one byte opcode.

- Some operations 'panic' and immediately fail the program. A transaction checked by a program that panics is not valid.
- A contract account governed by a buggy program might not have a way to get assets back out of it.


### Arithmetic, Logic, and Cryptographic Operations
- For one-argument ops, X is the last element on the stack, which is typically replaced by a new value.
- For two-argument ops, A is the penultimate element on the stack and B is the top of the stack. These typically result in popping A and B from the stack and pushing the result.
- For three-argument ops, A is the element two below the top, B is the penultimate stack element and C is the top of the stack. These operations typically pop A, B, and C from the stack and push the result.

| Op                      | Description
|:-----------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------
| `sha256`                | SHA256 hash of value X, yields \[32\]byte
| `keccak256`             | Keccak256 hash of value X, yields \[32\]byte
| `sha512_256`            | SHA512_256 hash of value X, yields \[32\]byte
| `ed25519verify`         | for (data A, signature B, pubkey C) verify the signature of ("ProgData" || program_hash || data) against the pubkey
| `ecdsa_verify v`        | for (data A, signature B, C and pubkey D, E) verify the signature of the data against the pubkey
| `ecdsa_pk_recover v`    | for (data A, recovery id B, signature C, D) recover a public key => \[... stack, X, Y\]
| `ecdsa_pk_decompress v` | decompress pubkey A into components X, Y => \[... stack, X, Y\]
| `+`                     | A plus B. Fail on overflow.
| `-`                     | A minus B. Fail if B > A.
| `/`                     | A divided by B (truncated division). Fail if B == 0.
| `*`                     | A times B. Fail on overflow.
| `<`                     | A less than B
| `>`                     | A greater than B
| `<=`                    | A less than or equal to B
| `>=`                    | A greater than or equal to B
| `&&`                    | A is not zero and B is not zero
| `||`                    | A is not zero or B is not zero
| `shl`                   | A times 2^B, modulo 2^64
| `shr`                   | A divided by 2^B
| `sqrt`                  | The largest integer B such that B^2 <= X
| `bitlen`                | The highest set bit in X. If X is a byte-array, it is interpreted as a big-endian unsigned integer. bitlen of 0 is 0, bitlen of 8 is 4
| `exp`                   | A raised to the Bth power. Fail if A == B == 0 and on overflow
| `==`                    | A is equal to B
| `!=`                    | A is not equal to B
| `!`                     | X == 0 yields 1; else 0
| `len`                   | yields length of byte value X
| `itob`                  | converts uint64 X to big endian bytes
| `btoi`                  | converts bytes X as big endian to uint64
| `%`                     | A modulo B. Fail if B == 0.
| `|`                     | A bitwise-or B
| `&`                     | A bitwise-and B
| `^`                     | A bitwise-xor B
| `~`                     | bitwise invert value X
| `mulw`                  | A times B out to 128-bit long result as low (top) and high uint64 values on the stack
| `addw`                  | A plus B out to 128-bit long result as sum (top) and carry-bit uint64 values on the stack
| `divmodw`               | Pop four uint64 values. The deepest two are interpreted as a uint128 dividend (deepest value is high word), the top two are interpreted as a uint128 divisor. Four uint64 values are pushed to the stack. The deepest two are the quotient (deeper value is the high uint64). The top two are the remainder, low bits on top.
| `expw`                  | A raised to the Bth power as a 128-bit long result as low (top) and high uint64 values on the stack. Fail if A == B == 0 or if the results exceeds 2^128-1
| `getbit`                | pop a target A (integer or byte-array), and index B. Push the Bth bit of A.
| `setbit`                | pop a target A, index B, and bit C. Set the Bth bit of A to C, and push the result
| `getbyte`               | pop a byte-array A and integer B. Extract the Bth byte of A and push it as an integer
| `setbyte`               | pop a byte-array A, integer B, and small integer C (between 0..255). Set the Bth byte of A to C, and push the result
| `concat`                | pop two byte-arrays A and B and join them, push the result

- These opcodes return portions of byte arrays, accessed by position, in various sizes.


### Byte Array Manipulation

| Op               | Description
|:----------------:|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
| `substring s e`  | pop a byte-array A. For immediate values in 0..255 S and E: extract a range of bytes from A starting at S up to but not including E, push the substring result. If E < S, or either is larger than the array length, the program fails
| `substring3`     | pop a byte-array A and two integers B and C. Extract a range of bytes from A starting at B up to but not including C, push the substring result. If C < B, or either is larger than the array length, the program fails
| `extract s l`    | pop a byte-array A. For immediate values in 0..255 S and L: extract a range of bytes from A starting at S up to but not including S+L, push the substring result. If L is 0, then extract to the end of the string. If S or S+L is larger than the array length, the program fails
| `extract3`       | pop a byte-array A and two integers B and C. Extract a range of bytes from A starting at B up to but not including B+C, push the substring result. If B+C is larger than the array length, the program fails
| `extract_uint16` | pop a byte-array A and integer B. Extract a range of bytes from A starting at B up to but not including B+2, convert bytes as big endian and push the uint64 result. If B+2 is larger than the array length, the program fails
| `extract_uint32` | pop a byte-array A and integer B. Extract a range of bytes from A starting at B up to but not including B+4, convert bytes as big endian and push the uint64 result. If B+4 is larger than the array length, the program fails
| `extract_uint64` | pop a byte-array A and integer B. Extract a range of bytes from A starting at B up to but not including B+8, convert bytes as big endian and push the uint64 result. If B+8 is larger than the array length, the program fails

- These opcodes take byte-array values that are interpreted as big-endian unsigned integers.
- For mathematical operators, the returned values are the shortest byte-array that can represent the returned value.

- Input lengths are limited to a maximum length 64 bytes, which represents a 512 bit unsigned integer.
- Output lengths are not explicitly restricted, though only b* and b+ can produce a larger output than their inputs, so there is an implicit length limit of 128 bytes on outputs.

| Op    | Description
|:-----:|:----------------------------------------------------------------------------------------------------------------------------------
| `b+`  | A plus B, where A and B are byte-arrays interpreted as big-endian unsigned integers
| `b-`  | A minus B, where A and B are byte-arrays interpreted as big-endian unsigned integers. Fail on underflow.
| `b/`  | A divided by B (truncated division), where A and B are byte-arrays interpreted as big-endian unsigned integers. Fail if B is zero.
| `b*`  | A times B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
| `b<`  | A is less than B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
| `b>`  | A is greater than B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
| `b<=` | A is less than or equal to B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
| `b>=` | A is greater than or equal to B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
| `b==` | A is equals to B, where A and B are byte-arrays interpreted as big-endian unsigned integers. 
| `b!=` | A is not equal to B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
| `b%`  | A modulo B, where A and B are byte-arrays interpreted as big-endian unsigned integers. Fail if B is zero.

- These opcodes operate on the bits of byte-array values.
- The shorter array is interpreted as though left padded with zeros until it is the same length as the other input.
- The returned values are the same length as the longest input. Therefore, unlike array arithmetic, these results may contain leading zero bytes.

| Op   | Description
|:----:|:---------------------------------------------------------------------------------------------------
| `b|` | A bitwise-or B, where A and B are byte-arrays, zero-left extended to the greater of their lengths.
| `b&` | A bitwise-and B, where A and B are byte-arrays, zero-left extended to the greater of their lengths.
| `b^` | A bitwise-xor B, where A and B are byte-arrays, zero-left extended to the greater of their lengths.
| `b~` | X with all bits inverted.


### Loading Values

- Opcodes for getting data onto the stack.
- Some of these have immediate data in the byte or bytes after the opcode.

| Op                     | Description
|:----------------------:|:----------------------------------------------------------------------------------------------------------------
| `intcblock uint ...`   | prepare block of uint64 constants for use by intc
| `intc i`               | push Ith constant from intcblock to stack
| `intc_0`               | push constant 0 from intcblock to stack
| `intc_1`               | push constant 1 from intcblock to stack
| `intc_2`               | push constant 2 from intcblock to stack
| `intc_3`               | push constant 3 from intcblock to stack
| `pushint uint`         | push immediate UINT to the stack as an integer
| `bytecblock bytes ...` | prepare block of byte-array constants for use by bytec 
| `bytec i`              | push Ith constant from bytecblock to stack
| `bytec_0`              | push constant 0 from bytecblock to stack
| `bytec_1`              | push constant 1 from bytecblock to stack
| `bytec_2`              | push constant 2 from bytecblock to stack
| `bytec_3`              | push constant 3 from bytecblock to stack
| `pushbytes bytes`      | push the following program bytes to the stack
| `bzero`                | push a byte-array of length X, containing all zero bytes
| `arg n`                | push Nth LogicSig argument to stack
| `arg_0`                | push LogicSig argument 0 to stack
| `arg_1`                | push LogicSig argument 1 to stack
| `arg_2`                | push LogicSig argument 2 to stack
| `arg_3`                | push LogicSig argument 3 to stack
| `args`                 | push Xth LogicSig argument to stack
| `txn f`                | push field F of current transaction to stack
| `gtxn t f`             | push field F of the Tth transaction in the current group
| `txna f i`             | push Ith value of the array field F of the current transaction
| `txnas f`              | push Xth value of the array field F of the current transaction
| `gtxna t f i`          | push Ith value of the array field F from the Tth transaction in the current group
| `gtxnas t f`           | push Xth value of the array field F from the Tth transaction in the current group
| `gtxns f`              | push field F of the Xth transaction in the current group
| `gtxnsa f i`           | push Ith value of the array field F from the Xth transaction in the current group
| `gtxnsas f`            | pop an index A and an index B. push Bth value of the array field F from the Ath transaction in the current group
| `global f`             | push value from globals to stack
| `load i`               | copy a value from scratch space to the stack. All scratch spaces are 0 at program start.
| `loads`                | copy a value from the Xth scratch space to the stack. All scratch spaces are 0 at program start.
| `store i`              | pop value X. store X to the Ith scratch space
| `stores`               | pop indexes A and B. store B to the Ath scratch space
| `gload t i`            | push Ith scratch space index of the Tth transaction in the current group
| `gloads i`             | push Ith scratch space index of the Xth transaction in the current group
| `gaid t`               | push the ID of the asset or application created in the Tth transaction of the current group
| `gaids`                | push the ID of the asset or application created in the Xth transaction of the current group

<To Be Continue>






















