import express from 'express';
import { ContainerType } from '../models/ContainerType';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

const transformContainerType = (containerType: any) => {
  const containerTypeObject = containerType.toObject();
  const { _id, allowedUoms, ...rest } = containerTypeObject;
  
  const transformedUoms = Array.isArray(allowedUoms) ? allowedUoms.map((uom: any) => {
    if (typeof uom === 'string') {
      return uom;
    }
    if (uom && typeof uom === 'object') {
      return uom.abbreviation || uom.name || String(uom);
    }
    return String(uom);
  }) : [];
  
  return {
    id: String(_id),
    ...rest,
    allowedUoms: transformedUoms
  };
};

// GET /api/container-types - Get all container types
router.get('/', async (req, res) => {
  try {
    const containerTypes = await ContainerType.find()
      .populate('allowedUoms', 'name abbreviation')
      .sort({ name: 1 });
    const transformedContainerTypes = containerTypes.map(transformContainerType);
    res.json(transformedContainerTypes);
  } catch (error) {
    console.error('Error fetching container types:', error);
    res.status(500).json({ error: 'Failed to fetch container types' });
  }
});

// POST /api/container-types - Create a new container type
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    const containerType = new ContainerType(data);
    await containerType.save();
    await containerType.populate('allowedUoms', 'name abbreviation');

    res.status(201).json(transformContainerType(containerType));
  } catch (error) {
    console.error('Error creating container type:', error);
    res.status(500).json({ error: 'Failed to create container type' });
  }
});

// GET /api/container-types/:id - Get a specific container type
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const containerType = await ContainerType.findById(id)
      .populate('allowedUoms', 'name abbreviation');

    if (!containerType) {
      return res.status(404).json({ error: 'Container type not found' });
    }

    res.json(transformContainerType(containerType));
  } catch (error) {
    console.error('Error fetching container type:', error);
    res.status(500).json({ error: 'Failed to fetch container type' });
  }
});

// PUT /api/container-types/:id - Update a specific container type
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const containerType = await ContainerType.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true }
    ).populate('allowedUoms', 'name abbreviation');

    if (!containerType) {
      return res.status(404).json({ error: 'Container type not found' });
    }

    res.json(transformContainerType(containerType));
  } catch (error) {
    console.error('Error updating container type:', error);
    res.status(500).json({ error: 'Failed to update container type' });
  }
});

// DELETE /api/container-types/:id - Delete a specific container type
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const containerType = await ContainerType.findByIdAndDelete(id);

    if (!containerType) {
      return res.status(404).json({ error: 'Container type not found' });
    }

    res.json({ message: 'Container type deleted successfully' });
  } catch (error) {
    console.error('Error deleting container type:', error);
    res.status(500).json({ error: 'Failed to delete container type' });
  }
});

export default router;