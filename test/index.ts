import { test } from '@bicycle-codes/tapzero'
import base64 from 'base64-js'
import { webcrypto } from '@bicycle-codes/one-webcrypto'
import { Keychain } from '../src/index.js'

import './metadata.js'
import './stream.js'

test('keychain properties', async t => {
    const keychain = new Keychain()

    t.ok(keychain.key instanceof Uint8Array)
    t.equal(keychain.key.byteLength, 16)

    t.ok(keychain.salt instanceof Uint8Array)
    t.equal(keychain.salt.byteLength, 16)

    t.equal(typeof keychain.keyB64, 'string')
    t.equal(keychain.keyB64.length, 22)

    t.equal(typeof keychain.saltB64, 'string')
    t.equal(keychain.saltB64.length, 24)

    const authToken = await keychain.authToken()
    t.ok(authToken instanceof Uint8Array)
    t.equal(authToken.byteLength, 16)

    const authTokenB64 = await keychain.authTokenB64()
    t.equal(typeof authTokenB64, 'string')
    t.equal(authTokenB64.length, 24)

    const authHeader = await keychain.authHeader()
    t.equal(typeof authHeader, 'string')
    t.equal(authHeader, `Bearer sync-v1 ${authTokenB64}`)
})

test('keychain from given key and salt (Uint8Array)', async t => {
    const key = webcrypto.getRandomValues(new Uint8Array(16))
    const salt = webcrypto.getRandomValues(new Uint8Array(16))

    const keychain = new Keychain(key, salt)

    t.deepEqual(keychain.key, key)
    t.deepEqual(keychain.salt, salt)
})

test('keychain from given key and salt (base64)', async t => {
    const key = webcrypto.getRandomValues(new Uint8Array(16))
    const salt = webcrypto.getRandomValues(new Uint8Array(16))

    const keychain = new Keychain(
        base64.fromByteArray(key),
        base64.fromByteArray(salt)
    )

    t.deepEqual(keychain.key, key)
    t.deepEqual(keychain.salt, salt)
})

test('keychain throws on invalid key or salt', async t => {
    t.throws(() => {
        // eslint-disable-next-line no-new
        new Keychain(new Uint8Array(15), new Uint8Array(16))
    })
    t.throws(() => {
        // eslint-disable-next-line no-new
        new Keychain(new Uint8Array(16), new Uint8Array(17))
    })
    t.throws(() => {
        // @ts-ignore
        new Keychain([])  // eslint-disable-line no-new
    })
    t.throws(() => {
        // @ts-ignore
        new Keychain({})  // eslint-disable-line no-new
    })
    t.throws(() => {
        // @ts-ignore
        new Keychain(10)  // eslint-disable-line no-new
    })
    t.throws(() => {
        // @ts-ignore
        new Keychain(true)  // eslint-disable-line no-new
    })
})

test('keychain.setAuthTokenB64', async t => {
    const keychain = new Keychain()

    const authToken = webcrypto.getRandomValues(new Uint8Array(16))
    keychain.setAuthToken(authToken)

    t.deepEqual(await keychain.authToken(), authToken)
    t.equal(await keychain.authTokenB64(), base64.fromByteArray(authToken))
})
