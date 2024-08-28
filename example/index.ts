import { FunctionComponent, render } from 'preact'
import { signal, computed } from '@preact/signals'
import { html } from 'htm/preact'
import { Keychain } from '../src/keychain.js'
import Debug from '@bicycle-codes/debug'
const debug = Debug()

// Create a new keychain. Since no arguments are specified, the key
// and salt are generated.
const keychain = new Keychain()

// Get a WHATWG stream somehow, from fetch(), from a Blob(), etc.
const response = await fetch('/')
const stream = response.body

// Create an encrypted version of that stream
const encryptedStream = await keychain.encryptStream(stream!)

// Normally you'd now use `encryptedStream`, e.g. in fetch(), etc.
// However, for this example, we'll just decrypt the stream immediately
const plaintextStream = await keychain.decryptStream(encryptedStream)

// Now, you can use `plaintextStream` and it will be identical to if you had
// used `stream`.

const reader = plaintextStream.getReader()
const { value } = await reader.read()
const asString = new TextDecoder().decode(value)
console.log('string...', asString)

const imgUrl = new URL('/cheesecake.jpeg', import.meta.url).href
const requestForImg = await fetch(imgUrl)
const encryptedImg = await keychain.encryptStream(requestForImg.body!)

/**
 * If a chunk is available to read, the promise will be fulfilled with an
 * object of the form { value: theChunk, done: false }.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams#reading_the_stream
 */

// const imgSignal = signal<ReadableStreamReadDoneResult<Uint8Array>|null>(null)
const imgSignal = signal<Blob|null>(null)

const urlSignal = computed(() => {
    if (!imgSignal.value) return null
    const newBlob = new Blob([imgSignal.value])
    const blobUrl = window.URL.createObjectURL(newBlob)
    return blobUrl
})

const Example:FunctionComponent = function Example () {
    debug('rendering...', urlSignal.value)
    return html`<div>
        <p>The cheesecake.jpeg, linked as unencrypted file:</p>
        <img src="${imgUrl}" />

        <p>
            Cheesecake, after requesting via <code>fetch</code>, encrypting,
            then decrypting:
        </p>
        <img src="${urlSignal.value}" />
    </div>`
}

render(html`<${Example} />`, document.getElementById('root')!)

/**
 * Pretend `encryptedImg` stream came from a server or something
 */
imgSignal.value = await new Response(encryptedImg).blob()

// encryptedImg.toArray()

// const decryptedStream = await keychain.decryptStream(encryptedImg)
// const decryptedReader = decryptedStream.getReader()
// imgSignal.value = await recursiveRead(decryptedReader, null)

// async function recursiveRead (
//     reader:ReadableStreamDefaultReader,
//     res:ReadableStreamReadResult<Uint8Array>|null
// ):Promise<ReadableStreamReadDoneResult<Uint8Array>> {
//     const newResult = await reader.read()
//     if (newResult.done) {
//         return { ...res, done: true as const }
//     }
//     return await recursiveRead(reader, newResult)
// }
