const ReturnedAzyk = require('../models/returnedAzyk');
const {parallelBulkWrite} = require('./parallel');
const {dayStartDefault} = require('./const');

module.exports.reductionReturneds = async () => {
    const returneds = await ReturnedAzyk.aggregate([
        {
            $addFields: {
                deliveryHourLocal: {
                    $hour: {
                        $add: [
                            '$dateDelivery',
                            1000 * 60 * 60 * 6 // смещение UTC+6 (Киргизстан)
                        ]
                    }
                }
            }
        },
        {
            $match: {
                deliveryHourLocal: { $ne: 3 }
            }
        }
    ]);
    console.log(`reductionReturneds ${returneds.length}`)
    if(returneds.length) {
        const bulkOperations = [];
        for(const returned of returneds) {
            const dateDelivery = new Date(returned.dateDelivery)
            dateDelivery.setHours(dayStartDefault, 0, 0, 0)
            bulkOperations.push({updateOne: {filter: {_id: returned._id}, update: {$set: {dateDelivery}}}});
        }
        await parallelBulkWrite(ReturnedAzyk, bulkOperations);
    }
}