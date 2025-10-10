const District = require('../models/districtAzyk');
const {parallelBulkWrite} = require('./parallel');

module.exports.reductionDistrict = async () => {
    const districts = await District.find({ ecspeditor: { $ne: null } }).select('ecspeditor _id').lean()
    const bulkOperations = []
    for(const district of districts) {
        bulkOperations.push({updateOne: {filter: {_id: district._id}, update: {$set: {forwarder: district.ecspeditor, ecspeditor: null}}}});

    }
    if(bulkOperations.length) await parallelBulkWrite(District, bulkOperations);
    console.log('reductionDistrict', bulkOperations.length)
}