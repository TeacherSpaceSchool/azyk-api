const ClientAzyk = require('../models/clientAzyk');
const UserAzyk = require('../models/userAzyk');

module.exports.reductionToClient = async() => {
    const oshUsers = await ClientAzyk.find({city: 'Ош'}).distinct('user').lean()
    const res = await UserAzyk.updateMany({_id: {$in: oshUsers}, status: 'deactive'}, {status: 'active'})
    console.log('reductionToClient: ', res)
}