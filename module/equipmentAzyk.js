const EquipmentAzyk = require('../models/equipmentAzyk');

module.exports.reductionEquipment = async() => {
    const date = new Date('2024-09-06T03:00:00.000Z')
    const equipments = await EquipmentAzyk.find({createdAt: {$lte: date}}).select('_id agent createdAt').lean()
    console.log('EquipmentAzyk update:', equipments.length)
    for(let i=0; i<equipments.length; i++) {
        const agentsHistory = []
        if(equipments[i].agent)
            agentsHistory.push({date: equipments[i].createdAt, agent: equipments[i].agent})
        await EquipmentAzyk.updateOne({_id: equipments[i]._id}, {agentsHistory})
    }
}