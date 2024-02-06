/**
 * Pipe a readable stream through a transformer. Returns a result, where
 * result.readable is the readable end of the TransformStream and
 * result.done is a promise that fulfills or rejects once the stream is done.
 * Includes a shim for environments where TransformStream is not available.
 */
export function transformStream (
    sourceReadable,
    transformer:Transformer
):{
    readable:ReadableStream,
    done:Promise<unknown>
} {
    let transformedReadable:ReadableStream<Uint8Array>
    let done

    if (typeof TransformStream !== 'undefined') {
        // Chrome, Edge, Safari 14.1+
        const transform = new TransformStream(transformer)

        done = sourceReadable.pipeTo(transform.writable)
        transformedReadable = transform.readable
    } else {
        // Firefox, Safari 14 and older
        let resolveDone
        let rejectDone
        done = new Promise((resolve, reject) => {
            resolveDone = resolve
            rejectDone = reject
        })

        const transformSource = new TransformStreamSource<Uint8Array>(
            sourceReadable,
            transformer,
            {
                resolveDone,
                rejectDone
            }
        )

        transformedReadable = new ReadableStream(transformSource)
    }

    // Ensure the caller doesn't need to catch errors
    done.catch(() => {})

    return {
        readable: transformedReadable,
        done
    }
}

class TransformStreamSource<T> {
    readable:ReadableStream
    transformer:Transformer
    resolveDone
    rejectDone
    reader
    progressMade:boolean
    wrappedController:null|TransformStreamDefaultController<T>
    type:'bytes' = 'bytes'

    constructor (
        readable,
        transformer:Transformer,
        {
            resolveDone,
            rejectDone
    }) {  // eslint-disable-line
        this.readable = readable
        this.transformer = transformer
        this.resolveDone = resolveDone
        this.rejectDone = rejectDone
        this.reader = readable.getReader()
        this.progressMade = false // reset on each pull
        this.wrappedController = null
    }

    // async start (controller:ReadableStreamController<T>) {
    async start (controller:ReadableByteStreamController) {
        this.wrappedController = {
            desiredSize: 5,

            enqueue: (value) => {
                this.progressMade = true
                controller.enqueue(value)
            },
            error: (reason) => {
                this.progressMade = true
                if (!(reason instanceof Error)) {
                    reason = new Error(`stream errored; reason: ${reason}`)
                }
                controller.error(reason)
                this.reader.cancel(reason).catch(() => {})
                this.rejectDone(reason)
            },
            terminate: () => {
                this.progressMade = true
                controller.close()
                this.reader.cancel(new Error('stream terminated')).catch(() => {})
                this.resolveDone()
            }
        }

        if (this.transformer.start) {
            try {
                await this.transformer.start(this.wrappedController)
            } catch (err) {
                this.rejectDone(err)
                throw err
            }
        }
    }

    async pull (controller) {
        this.progressMade = false
        // eslint-disable-next-line no-unmodified-loop-condition
        while (!this.progressMade) {
            try {
                const data = await this.reader.read()
                if (!this.wrappedController) {
                    throw new Error('not this.wrappedController')
                }
                if (data.done) {
                    if (this.transformer.flush) {
                        await this.transformer.flush(this.wrappedController)
                    }
                    controller.close()
                    this.resolveDone()
                    return
                }
                if (this.transformer.transform) {
                    await this.transformer.transform(
                        data.value,
                        this.wrappedController!
                    )
                } else {
                    if (!this.wrappedController) {
                        throw new Error('not wrapped controller')
                    }
                    this.wrappedController.enqueue(data.value)
                }
            } catch (err) {
                this.rejectDone(err)
                this.reader.cancel(err).catch(() => {})
                throw err
            }
        }
    }

    async cancel (reason) {
        await this.reader.cancel(reason)
        if (reason instanceof Error) {
            this.rejectDone(reason)
        } else {
            this.rejectDone(new Error(`stream cancelled; reason: ${reason}`))
        }
    }
}
