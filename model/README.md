# Dish Detection Model Training

Fine-tuning YOLOv8 for dish detection in kitchen sinks.

## Overview

This notebook fine-tunes YOLOv8 on a combined dataset from multiple sources to detect dishes in sink images.

## Usage

1. **Setup** (Cell 0): Imports and sets up working directory
2. **Dataset Download** (Cell 1): Downloads and combines datasets from Roboflow
3. **Training** (Cell 2): Trains YOLOv8 model with optimized hyperparameters
4. **Save Model** (Cell 3): Saves the best model as `dish_detector.pt`
5. **Generate Results** (Cell 4): Creates visualizations and performance summary

## Outputs

After running all cells, the following are generated:

- **`dish_detector.pt`**: Final trained model
- **`results/`**: Contains:
  - `figure1_total_loss.png`: Training loss curves
  - `figure2_performance_metrics.png`: Performance metrics over training
  - `figure3_sample_detections.png`: Sample detection results
  - `performance_summary.txt`: Validation and test metrics

## Requirements

- Python 3.8+
- ultralytics
- roboflow
- torch
- matplotlib
- opencv-python
- pandas

Install with: `pip install ultralytics roboflow torch matplotlib opencv-python pandas`