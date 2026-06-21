function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
