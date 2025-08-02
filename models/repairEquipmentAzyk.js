const mongoose = require('mongoose');

const RepairEquipmentAzykSchema = mongoose.Schema({
    number: String,
    status: String,
    equipment: String,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    repairMan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    accept: {
        type: Boolean,
        default: false
   },
    done: {
        type: Boolean,
        default: false
   },
    cancel: {
        type: Boolean,
        default: false
   },
    defect: [String],
    repair: [String],
    dateRepair: Date,
}, {
    timestamps: true
});


const RepairEquipmentAzyk = mongoose.model('RepairEquipmentAzyk', RepairEquipmentAzykSchema);

module.exports = RepairEquipmentAzyk;