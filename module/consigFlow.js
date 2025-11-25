const {checkFloat, isObject} = require('./const');
const ConsigFlowAzyk = require('../models/consigFlowAzyk');
const {parallelBulkWrite} = require('./parallel');
const InvoiceAzyk = require('../models/invoiceAzyk');

module.exports.calculateConsig = async (invoice) => {
    if(!isObject(invoice))
        invoice = await InvoiceAzyk.findById(invoice).lean()
    if(invoice.paymentMethod==='Консигнация') {
        const amount = checkFloat(invoice.allPrice - invoice.rejectedPrice)
        const consigFlow = await ConsigFlowAzyk.findOne({invoice: invoice._id}).select('_id').lean()
        if (invoice.cancelClient||invoice.cancelForwarder) {
            if (consigFlow) await ConsigFlowAzyk.updateOne({invoice: invoice._id}, {cancel: true, amount})
        }
        else {
            if (!consigFlow) {
                await ConsigFlowAzyk.create({
                    organization: invoice.organization,
                    invoice: invoice._id,
                    client: invoice.client,
                    amount,
                    sign: 1
                })
            } else {
                await ConsigFlowAzyk.updateOne({_id: consigFlow._id}, {cancel: false, amount})
            }
        }
    }
    else {
        await ConsigFlowAzyk.deleteOne({invoice: invoice._id})
    }
}

module.exports.mockConsigFlow = async () => {
    console.log('start mockConsigFlow')
    await ConsigFlowAzyk.deleteMany();
    const InvoiceAzyk = require('../models/invoiceAzyk');
    const invoices = await InvoiceAzyk.find({paymentMethod: 'Консигнация', organization: '5e00a5c0f2cd0f4f82eac3db'}).lean()
    //bulkwrite
    const bulkOperations = [];
    //перебор
    for(let i = 0; i < invoices.length; i += 1) {
        const invoice = invoices[i]
        bulkOperations.push({insertOne: {document: {
            createdAt: invoice.createdAt,
            organization: invoice.organization,
            invoice: invoice._id,
            client: invoice.client,
            amount: checkFloat(invoice.allPrice - invoice.rejectedPrice),
            sign: i%2?-1:1,
            cancel: !!(invoice.cancelClient||invoice.cancelForwarder)
        }}});
    }
    // если есть обновления — выполним bulkWrite
    if (bulkOperations.length) await parallelBulkWrite(ConsigFlowAzyk, bulkOperations);
    console.log('end mockConsigFlow')
}