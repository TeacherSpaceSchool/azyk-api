const EquipmentAzyk = require('../models/equipmentAzyk');
const DistrictAzyk = require('../models/districtAzyk');

module.exports.reductionEquipment = async() => {
    const date = new Date('2024-08-28T03:00:00.000Z')
    const equipments = await EquipmentAzyk.find({createdAt: {$lte: date}, client: {$ne: null}}).select('_id client').lean()
    console.log('EquipmentAzyk update:', equipments.length)
    for(let i=0; i<equipments.length; i++) {
        let district = await DistrictAzyk.findOne({client: equipments[i].client}).select('agent').lean()
        if(district)
            await EquipmentAzyk.updateOne({_id: equipments[i]._id}, {agent: district.agent})
    }
}