const mongoose = require('mongoose');

const HistoryAzykSchema = mongoose.Schema({
    employment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAzyk'
   },
    object: String,
    //delete set create
    type: Number,
    model: String,
    name: String,
    data: String
}, {
    timestamps: true
});


const HistoryAzyk = mongoose.model('HistoryAzyk', HistoryAzykSchema);

module.exports = HistoryAzyk;