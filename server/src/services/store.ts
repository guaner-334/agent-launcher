import fs from 'fs';
import path from 'path';
import { Instance } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const DATA_FILE = path.join(DATA_DIR, 'instances.json');

class Store {
  private instances: Instance[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        this.instances = JSON.parse(data);
      } else {
        this.instances = [];
        this.save();
      }
    } catch (err) {
      console.error('Failed to load store:', err);
      this.instances = [];
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.instances, null, 2));
    } catch (err) {
      console.error('Failed to save store:', err);
    }
  }

  getAll(): Instance[] {
    return [...this.instances];
  }

  getById(id: string): Instance | undefined {
    return this.instances.find(i => i.id === id);
  }

  create(instance: Instance): Instance {
    this.instances.push(instance);
    this.save();
    return instance;
  }

  update(id: string, updates: Partial<Instance>): Instance | undefined {
    const index = this.instances.findIndex(i => i.id === id);
    if (index === -1) return undefined;
    this.instances[index] = { ...this.instances[index], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.instances[index];
  }

  delete(id: string): boolean {
    const index = this.instances.findIndex(i => i.id === id);
    if (index === -1) return false;
    this.instances.splice(index, 1);
    this.save();
    return true;
  }
}

export const store = new Store();
