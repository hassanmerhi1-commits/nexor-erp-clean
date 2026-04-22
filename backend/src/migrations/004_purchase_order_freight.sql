-- Migration: Add freight and landing costs to purchase orders
-- Run this on your PostgreSQL server

-- Add freight cost columns to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS freight_cost DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_costs DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_costs_description TEXT,
ADD COLUMN IF NOT EXISTS freight_distributed BOOLEAN DEFAULT false;

-- Add freight allocation columns to purchase_order_items
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS freight_allocation DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS effective_cost DECIMAL(15, 2);

-- Update effective_cost to equal unit_cost for existing records
UPDATE purchase_order_items 
SET effective_cost = unit_cost 
WHERE effective_cost IS NULL;
