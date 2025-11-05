const ClientAzyk = require('../models/clientAzyk');
const {parallelBulkWrite} = require('./parallel');

module.exports.reductionClientAzyk = async () => {
    const clients = await ClientAzyk.find({phone: { $elemMatch: { $regex: '555780861', $options: 'i' } }}).select('phone _id').lean()
    const bulkOperations = []
    for(const client of clients) {
        bulkOperations.push({updateOne: {filter: {_id: client._id}, update: {$set: {phone: client.phone.filter(phone => !phone.includes('555780861')), sync: []}}}});
    }
    if(bulkOperations.length) await parallelBulkWrite(ClientAzyk, bulkOperations);
    console.log('reductionClientAzyk', bulkOperations.length)
}