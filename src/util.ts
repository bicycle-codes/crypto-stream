import { webcrypto } from '@bicycle-codes/one-webcrypto'

export function generateSalt (len:number):Uint8Array {
    const salt = new Uint8Array(len)
    webcrypto.getRandomValues(salt)
    return salt
}
