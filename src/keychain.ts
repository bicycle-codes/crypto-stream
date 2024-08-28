import { webcrypto } from '@bicycle-codes/one-webcrypto'
import base64 from 'base64-js'
import {
    decryptStream,
    decryptStreamRange,
    encryptStream
} from './ece.js'

export {
    encryptedSize,
    plaintextSize
} from './ece.js'

const IV_LENGTH = 16

const encoder = new TextEncoder()

function arrayToB64 (array) {
    return base64.fromByteArray(array)
}

/**
 * Return the given Uint8Array as a base64url string.
 * @param array Uint8Array
 * @returns `base64url` encoded string
 */
function arrayToB64Url (array:Uint8Array):string {
    return base64
        .fromByteArray(array)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

function b64ToArray (str:string):Uint8Array {
    return base64.toByteArray(str + '==='.slice((str.length + 3) % 4))
}

function decodeBits (bitsB64?:Uint8Array|string|null):Uint8Array {
    let result
    if (bitsB64 instanceof Uint8Array) {
        result = bitsB64
    } else if (typeof bitsB64 === 'string') {
        result = b64ToArray(bitsB64)
    } else if (bitsB64 == null) {
        result = webcrypto.getRandomValues(new Uint8Array(16))
    } else {
        throw new Error('Must be Uint8Array, string, or nullish')
    }

    if (result.byteLength !== 16) {
        throw new Error('Invalid byteLength: must be 16 bytes')
    }
    return result
}

export class Keychain {
    key:Uint8Array
    salt:Uint8Array
    mainKeyPromise:Promise<CryptoKey>
    metaKeyPromise:Promise<CryptoKey>
    authTokenPromise:Promise<Uint8Array>

    constructor (key?:string|Uint8Array, salt?:string|Uint8Array) {
        this.key = decodeBits(key)
        this.salt = decodeBits(salt)

        this.mainKeyPromise = webcrypto.subtle.importKey(
            'raw',
            this.key,
            'HKDF',
            false,
            ['deriveBits', 'deriveKey']
        )

        this.metaKeyPromise = this.mainKeyPromise
            .then(mainKey =>
                webcrypto.subtle.deriveKey(
                    {
                        name: 'HKDF',
                        hash: 'SHA-256',
                        salt: this.salt,
                        info: encoder.encode('metadata')
                    },
                    mainKey,
                    {
                        name: 'AES-GCM',
                        length: 128
                    },
                    false,
                    ['encrypt', 'decrypt']
                )
            )

        this.authTokenPromise = this.mainKeyPromise
            .then(mainKey =>
                webcrypto.subtle.deriveBits(
                    {
                        name: 'HKDF',
                        hash: 'SHA-256',
                        salt: this.salt,
                        info: encoder.encode('authentication')
                    },
                    mainKey,
                    128
                )
            )
            .then(authTokenBuf => new Uint8Array(authTokenBuf))
    }

    /**
     * Get the main key as a `base64url` encoded string
     */
    get keyB64 ():string {
        return arrayToB64Url(this.key)
    }

    /**
     * Get the salt as base64 string
     */
    get saltB64 ():string {
        return arrayToB64(this.salt)
    }

    /**
     * get a promise for the auth token.
     * @returns {Promise<Uint8Array>}
     */
    async authToken ():Promise<Uint8Array> {
        return await this.authTokenPromise
    }

    /**
     * Get the auth token as a base64 string
     */
    async authTokenB64 ():Promise<string> {
        const authToken = await this.authToken()
        return arrayToB64(authToken)
    }

    /**
     * Get a header string: `Bearer sync-v1 ${authTokenB64}`
     */
    async authHeader ():Promise<string> {
        const authTokenB64 = await this.authTokenB64()
        return `Bearer sync-v1 ${authTokenB64}`
    }

    /**
     * Set the auth token
     * @param authToken The new token
     */
    setAuthToken (authToken?:string|Uint8Array):void {
        this.authTokenPromise = Promise.resolve(decodeBits(authToken))
    }

    /**
     * Take a stream, return an encrypted stream.
     * @param stream Input stream
     * @returns {Promise<ReadableStream>}
     */
    async encryptStream (
        stream:ReadableStream<Uint8Array>
    ):Promise<ReadableStream<Uint8Array>> {
        if (!(stream instanceof ReadableStream)) {
            throw new TypeError('This is not a readable stream')
        }
        const mainKey = await this.mainKeyPromise
        return encryptStream(stream, mainKey)
    }

    /**
     * Take an encrypted stream, return a decrypted stream.
     * @param encryptedStream The input (encrypted) stream
     * @returns The decrypted stream
     */
    async decryptStream (
        encryptedStream:ReadableStream<Uint8Array>
    ):Promise<ReadableStream<Uint8Array>> {
        if (!(encryptedStream instanceof ReadableStream)) {
            throw new TypeError('encryptedStream is not a ReadableStream')
        }
        const mainKey = await this.mainKeyPromise
        return decryptStream(encryptedStream, mainKey)
    }

    /**
     * Returns an object containing `ranges`, an array of objects
     * containing `offset` and `length` integers specifying the encrypted byte
     * ranges that are needed to decrypt the client's specified range, and a
     * `decrypt` function.
     *
     * @param {number} offset Integer
     * @param {number} length Integer
     * @param {number} totalEncryptedLength Integer
     * @returns {Promise<{ ranges, decrypt }>}
     */
    async decryptStreamRange (
        offset:number,
        length:number,
        totalEncryptedLength:number
    ):Promise<{
        ranges:{ offset:number, length:number }[],
        decrypt:(streams:ReadableStream[])=>ReadableStream
    }> {
        if (!Number.isInteger(offset)) {
            throw new TypeError('offset')
        }
        if (!Number.isInteger(length)) {
            throw new TypeError('length')
        }
        if (!Number.isInteger(totalEncryptedLength)) {
            throw new TypeError('totalEncryptedLength')
        }

        const mainKey = await this.mainKeyPromise
        return decryptStreamRange(mainKey, offset, length, totalEncryptedLength)
    }

    async encryptMeta (meta:Uint8Array):Promise<Uint8Array> {
        if (!(meta instanceof Uint8Array)) {
            throw new TypeError('`meta` should be Uint8Array')
        }

        const iv:Uint8Array = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH))
        const metaKey:CryptoKey = await this.metaKeyPromise

        const encryptedMetaBuf:ArrayBuffer = await webcrypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv,
                tagLength: 128
            },
            metaKey,
            meta
        )

        const encryptedMeta = new Uint8Array(encryptedMetaBuf)

        const ivEncryptedMeta = new Uint8Array(IV_LENGTH + encryptedMeta.byteLength)
        ivEncryptedMeta.set(iv, 0)
        ivEncryptedMeta.set(encryptedMeta, IV_LENGTH)

        return ivEncryptedMeta
    }

    async decryptMeta (ivEncryptedMeta:Uint8Array):Promise<Uint8Array> {
        if (!(ivEncryptedMeta instanceof Uint8Array)) {
            throw new Error('ivEncryptedMeta')
        }

        const iv = ivEncryptedMeta.slice(0, IV_LENGTH)
        const encryptedMeta = ivEncryptedMeta.slice(IV_LENGTH)

        const metaKey = await this.metaKeyPromise
        const metaBuf = await webcrypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv,
                tagLength: 128
            },
            metaKey,
            encryptedMeta
        )
        const meta = new Uint8Array(metaBuf)
        return meta
    }
}
