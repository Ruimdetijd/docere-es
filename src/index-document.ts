import * as es from 'elasticsearch'
import { defaultMetadata } from 'docere-config'

const client = new es.Client({
	host: 'localhost:9200'
})

export async function deleteIndex(slug: string) {
	try {
		await client.indices.delete({ index: slug })	
	} catch (err) {
		console.log('deleteIndex', err)	
	}
}

export async function createIndex(slug: string, config: DocereConfig) {
	const properties: Record<string, { type: EsDataType }> = {}

	config.metadata.forEach(md => {
		const metadataConfig = { ...defaultMetadata, ...md }
		properties[metadataConfig.id] = { type: metadataConfig.datatype }
	})

	config.textdata.forEach(td => {
		const textdataConfig = { ...defaultMetadata, ...td }
		properties[textdataConfig.id] = { type: textdataConfig.datatype }
	})

	properties.text = { type: EsDataType.text }

	try {
		await client.indices.create({
			index: slug,
			body: {
				mappings: {
					doc: {
						properties
					}
				}
			}
		})	
	} catch (err) {
		console.log('createIndex', err)
	}
}

export default async function indexDocument(projectSlug: string, indexDocument: any) {
	const { id, ...body } = indexDocument
	try {
		await client.index({
			id,
			index: projectSlug,
			type: 'doc',
			body,
		})
	} catch (err) {
		console.log('indexDocument', err)
	}
}
