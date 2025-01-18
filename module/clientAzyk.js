const ClientAzyk = require('../models/clientAzyk');
const UserAzyk = require('../models/userAzyk');
const {deleteFile} = require('./const');

module.exports.reductionToClient = async() => {
    /*const jalalAbadClients = await ClientAzyk.find({city: 'Жалал-Абад'}).select('_id user image').lean()
    const clientsForDelete = [], usersForDelete = []
    for(let i=0; i<jalalAbadClients.length; i++){
        clientsForDelete.push(jalalAbadClients[i]._id)
        usersForDelete.push(jalalAbadClients[i].user)
        if(jalalAbadClients[i].image) {
            await deleteFile(jalalAbadClients[i].image)
        }
    }
    await ClientAzyk.deleteMany({_id: {$in: clientsForDelete}})
    await UserAzyk.deleteMany({_id: {$in: usersForDelete}})
    console.log('reductionToClient: ', jalalAbadClients.length)*/
}