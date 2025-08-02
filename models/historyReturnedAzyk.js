const mongoose = require('mongoose');

const HistoryReturnedAzykSchema = mongoose.Schema({
    returned: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReturnedAzyk'
   },
    editor: String,
}, {
    timestamps: true
});


const HistoryReturnedAzyk = mongoose.model('HistoryReturnedAzyk', HistoryReturnedAzykSchema);

module.exports = HistoryReturnedAzyk;