# crypto stream
![tests](https://github.com/bicycle-codes/crypto-stream/actions/workflows/nodejs.yml/badge.svg)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
[![license](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE)

Streaming encryption for the browser, based on [Encrypted Content-Encoding for HTTP (RFC 8188)](https://tools.ietf.org/html/rfc8188)

## install
```sh
npm i -S @bicycle-codes/crypto-stream
```

## fork
This is a fork of [SocketDev/wormhole-crypto](https://github.com/SocketDev/wormhole-crypto), just adding types.

## example

```js
import { Keychain } from '@bicycle-codes/crypto-stream'

// Create a new keychain. Since no arguments are specified, the key and salt
// are generated.
const keychain = new Keychain()

// Get a WHATWG stream somehow, from fetch(), from a Blob(), etc.
const stream = getStream()

// Create an encrypted version of that stream
const encryptedStream = await keychain.encryptStream(stream)

// Normally you'd now use `encryptedStream`, e.g. in fetch(), etc.
// However, for this example, we'll just decrypt the stream immediately
const plaintextStream = await keychain.decryptStream(encryptedStream)

// Now, you can use `plaintextStream` and it will be identical to if you had
// used `stream`.
```

## credits

Thank you [Feross](https://github.com/feross) and [SocketDev](https://github.com/SocketDev) team.

This is a fork of the [wormhole-crypto](https://github.com/SocketDev/wormhole-crypto) package, just adding some types.
