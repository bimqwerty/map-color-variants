const R = require('ramda');
module.exports = {
    async getBulkOperation(shopifyApi) {
        const query = `query {
          currentBulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }`

        const bulkOperation = await shopifyApi.graphql(query)
        return bulkOperation
    },
    async cancelBulkOperation(shopifyApi, id) {
        const query = `mutation bulkOperationCancel($id: ID!) {
            bulkOperationCancel(id: $id) {
              bulkOperation {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`
        const queryResult = await shopifyApi.graphql(query, {
            "id": id
        })
        let cancelled = false
        process.stdout.write('Canceling bulk operation');
        while (!cancelled) {
            const bulkOperation = await getBulkOperation(shopifyApi)
            if (bulkOperation.currentBulkOperation && bulkOperation.currentBulkOperation.status === 'CANCELED') {
                cancelled = true
            }
            process.stdout.write('.');
            //  await delay(500)
        }
        return
    },

    assembleJsonLines(result) {
        let jsonLines = []
        let lines = []
        if (!result) {
            return lines
        }

        jsonLines = result.split('\n')
        for (let i = 0; i < jsonLines.length; i++) {
            const line = jsonLines[i]
            if (!line) {
                continue
            }
            if (line.indexOf('{') == -1 || line.indexOf('}') == -1) {
                continue
            }
            const lineJson = JSON.parse(line)

            if (lineJson.allocationMethod) {
                const line = R.find(R.propEq('id', lineJson.__parentId))(lines)
                if (line) {
                    line.discountApplications.push(lineJson)
                }
            } else if (lineJson.id.indexOf('gid://shopify/Order') > -1) {
                lineJson.lineItems = []
                lineJson.discountApplications = []
                lines.push(lineJson)
            } else if (lineJson.id.indexOf('gid://shopify/LineItem/') > -1) {
                const line = R.find(R.propEq('id', lineJson.__parentId))(lines)
                if (line) {
                    line.lineItems.push(lineJson)
                }
            } else if (lineJson.id.indexOf('gid://shopify/Product/') > -1) {
                lineJson.metafields = []
                lineJson.variants = []
                lineJson.images = []
                lines.push(lineJson)
            } else if (lineJson.id.indexOf('gid://shopify/ProductImage/') > -1) {
                const line = R.find(R.propEq('id', lineJson.__parentId))(lines)
                if (line) {
                    line.images.push(lineJson)
                }
            } else if (lineJson.id.indexOf('gid://shopify/Metafield/') > -1) {
                const line = R.find(R.propEq('id', lineJson.__parentId))(lines)
                if (line) {
                    line.metafields.push(lineJson)
                }
            } else if (lineJson.id.indexOf('gid://shopify/ProductVariant/') > -1) {
                const line = R.find(R.propEq('id', lineJson.__parentId))(lines)
                if (line) {
                    line.variants.push(lineJson)
                }
            }
        }
        return lines
    }
};