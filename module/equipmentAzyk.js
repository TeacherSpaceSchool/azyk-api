const EquipmentAzyk = require('../models/equipmentAzyk');

module.exports.reductionEquipment = async() => {
    const date = new Date('2024-09-12T03:00:00.000Z')
    const equipments = await EquipmentAzyk.find({createdAt: {$lte: date}, client: {$ne: null}}).select('_id agent').lean()
    console.log('EquipmentAzyk update:', equipments.length)
    for(let i=0; i<equipments.length; i++) {
        const agentsHistory = []
        if(equipments[i].agent)
            agentsHistory.push(equipments[i].agent)
        await EquipmentAzyk.updateOne({_id: equipments[i]._id}, {agentsHistory})
    }
}