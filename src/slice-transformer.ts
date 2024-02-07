/**
 * Tranform stream that outputs chunks of a specific size. Final chunk may be
 * less than the desired size.
 *
 * firstChunkSize: The size of the first chunk
 * restChunkSize:  The size of all subsequent chunks, optional. If omitted, the
 *                 size of subsequenct chunks will be same as `firstChunkSize`
 */

export class SliceTransformer {
    chunkSize:number
    restChunkSize:number
    partialChunk:Uint8Array
    offset:number

    constructor (firstChunkSize:number, restChunkSize?:number) {
        this.chunkSize = firstChunkSize
        this.restChunkSize = restChunkSize || firstChunkSize

        this.partialChunk = new Uint8Array(this.chunkSize)
        this.offset = 0  // offset into `partialChunk`
    }

    send (record:Uint8Array, controller:TransformStreamDefaultController):void {
        controller.enqueue(record)
        this.chunkSize = this.restChunkSize
        this.partialChunk = new Uint8Array(this.chunkSize)
        this.offset = 0
    }

    transform (
        chunk:Uint8Array,
        controller:TransformStreamDefaultController
    ):void {
        let i = 0  // offset into `chunk`

        if (this.offset > 0) {
            const len = Math.min(chunk.byteLength, this.chunkSize - this.offset)
            this.partialChunk.set(chunk.subarray(0, len), this.offset)
            this.offset += len
            i += len

            if (this.offset === this.chunkSize) {
                this.send(this.partialChunk, controller)
            }
        }

        while (i < chunk.byteLength) {
            const remainingBytes = chunk.byteLength - i
            if (remainingBytes >= this.chunkSize) {
                const record = chunk.slice(i, i + this.chunkSize)
                i += this.chunkSize
                this.send(record, controller)
            } else {
                const end = chunk.slice(i, i + remainingBytes)
                i += end.byteLength
                this.partialChunk.set(end)
                this.offset = end.byteLength
            }
        }
    }

    flush (controller:TransformStreamDefaultController):void {
        if (this.offset > 0) {
            controller.enqueue(this.partialChunk.subarray(0, this.offset))
        }
    }
}
