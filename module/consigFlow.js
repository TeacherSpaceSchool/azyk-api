const ConsigFlow = require('../models/consigFlowAzyk');

module.exports.consignationConsigFlow = async (invoice) => {
    const consigFlow = await ConsigFlow.findOne({invoice: invoice._id}).select('_id').lean()
    if(invoice.taken) {
        if (!consigFlow) {
            await ConsigFlow.create({
                organization: invoice.organization,
                invoice: invoice._id,
                client: invoice.client,
                amount: invoice.allPrice - invoice.returnedPrice,
                sign: 1
            })
        } else {
            await ConsigFlow.updateOne({_id: consigFlow._id}, {cancel: false})
        }
    }
    else if(consigFlow) {
        await ConsigFlow.updateOne({invoice: invoice._id}, {cancel: true})
    }
}