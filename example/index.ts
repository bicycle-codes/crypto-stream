import { FunctionComponent, render } from 'preact'
import { html } from 'htm/preact'
import { Keychain } from '../src/keychain.js'

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

const imgUrl = new URL('./cheesecake.jpeg', import.meta.url).href
const requestForImg = await fetch(imgUrl)
const encryptedImg = await keychain.encryptStream(requestForImg.body!)
const decryptedStream = await keychain.decryptStream(encryptedImg)
const res = new Response(decryptedStream)
const blob = await res.blob()
const newBlob = new Blob([blob])
const blobUrl = window.URL.createObjectURL(newBlob)

const Example:FunctionComponent = function Example () {
    return html`<div>
        <p>The cheesecake.jpeg, imported as unencrypted file:</p>
        <img src="${imgUrl}" />

        <p>
            Cheesecake, after requesting via <code>fetch</code>, encrypting,
            then decrypting:
        </p>
        <img src="${blobUrl}" />
    </div>`
}

render(html`<${Example} />`, document.getElementById('root')!)
