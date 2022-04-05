
const Shopify = require('shopify-api-node');
const axios = require('axios')
const graphApiHelper = require('./graphApiHelper.js');


async function mapColorVariants(shop, accessToken, apiVersion) {
    const shopifyApi = new Shopify({
        shopName: shop,
        accessToken: accessToken,
        apiVersion: apiVersion
    });
    try {
        const query = `mutation {
        bulkOperationRunQuery(
          query: """
          {
            products {
              edges {
                node {
                  id
                  createdAt
                  title
                  productType
                  status
                  publishedAt
                  vendor
                  handle
                  tags
                  linkedColors: metafield (namespace: "veromoda", key: "color_variant_handles" ) {
                    id
                    value
                  }
                  options { 
                    id
                    name
                  }
                  variants {
                    edges {
                      node {
                        id
                        sku
                        selectedOptions {
                          name 
                          value
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          """
        )  {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`
        const queryResult = await shopifyApi.graphql(query)
        if (queryResult.userErrors) {
            console.log(`Error performing query: ${JSON.stringify(queryResult.userErrors)}`)
            return null
        }
        let queryUrl = null
        process.stdout.write('Waiting for bulk query to finish: ');
        while (!queryUrl) {
            const bulkOperation = await graphApiHelper.getBulkOperation(shopifyApi)
            if (bulkOperation.currentBulkOperation && bulkOperation.currentBulkOperation.status == 'COMPLETED') {
                if (bulkOperation.currentBulkOperation.url) {
                    queryUrl = bulkOperation.currentBulkOperation.url
                } else {
                    throw new Error('No url, abort??')
                }
            }
            process.stdout.write('.');
        }
        if (queryUrl == 'N/A') {
            return null
        }
        const result = await axios.get(queryUrl)
        process.stdout.write('DONE FETCHING');
        const arrRes = graphApiHelper.assembleJsonLines(result.data)
        const arrResLength = arrRes.length
        console.log('__')
        console.log('BEGIN --- UPDATE METAFIELDS FOR PRODUCT');
        var responseFinal = []
        for (let j = 0; j < arrRes.length; j++) {
            const product = arrRes[j]
            const productTitle = product.title
            const productTitleArr = productTitle.split(' - ')
            const arrHandle = []
            if (productTitleArr.length === 2) {
                const productName = productTitleArr[0]
                for (let i = 0; i < arrResLength; i++) {
                    itemTitleArr = arrRes[i].title.split(' - ')
                    if (productName === itemTitleArr[0] && productTitle !== arrRes[i].title) {
                        arrHandle.push(arrRes[i].handle)
                    }
                }
            }
            if (arrHandle.length > 0) {
                let variables = {}
                let metafieldsIns = []
                let metafieldIns = {}
                metafieldIns.key = 'color_variant_handles'
                metafieldIns.namespace = 'veromoda'
                metafieldIns.type = 'json'
                //graph id
                metafieldIns.ownerId = product.id

                let objValue = {}
                objValue.handles = arrHandle
                metafieldIns.value = JSON.stringify(arrHandle)

                metafieldsIns.push(metafieldIns)
                variables.metafields = metafieldsIns

                const data = `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                type
                key
                namespace
                value
                createdAt
                updatedAt
              }
              userErrors {
                field
                message
                code
              }
            }
          }`;
                const queryResult = await shopifyApi.graphql(data, variables)

                let responseCRUD = {}
                responseCRUD.ownerId = product.id
                if (queryResult.metafieldsSet.userErrors.length > 0) {
                    responseCRUD.result = 'FAIL'
                    responseCRUD = { ...responseCRUD, ...queryResult.metafieldsSet.userErrors[0] }
                } else {
                    responseCRUD.result = 'OK'
                }
                responseFinal.push(responseCRUD)
            }

        }
        console.log('END --- UPDATE METAFIELDS FOR PRODUCT');
        return responseFinal
    }
    catch (e) {
        console.log(e)
        return "internal error"
    }
}


module.exports = mapColorVariants;








