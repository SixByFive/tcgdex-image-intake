'use strict'; 

function healthController(req, res) {
    res.status(200).json({ ok: true, service: 'tcgdex-image-intake' }); 
}

module.exports = { healthController };