const Integrate1C = require('../models/integrate1CAzyk');
const {parallelBulkWrite} = require('./parallel');

module.exports.reductionIntegrate1C = async () => {
    const integrate1Cs = await Integrate1C.find({ ecspeditor: { $ne: null } }).select('ecspeditor _id').lean()
    const bulkOperations = []
    for(const integrate1C of integrate1Cs) {
        bulkOperations.push({updateOne: {filter: {_id: integrate1C._id}, update: {$set: {forwarder: integrate1C.ecspeditor, ecspeditor: null}}}});

    }
    if(bulkOperations.length) await parallelBulkWrite(Integrate1C, bulkOperations);
    console.log('reductionDistrict', bulkOperations.length)
}