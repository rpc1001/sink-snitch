"""
YOLOv8 Fine-tuning Pipeline for SinkSnitch
Downloads kitchen objects from OpenImages and trains a custom model
"""

# Step 1: Install required packages
# Run this in your terminal first:
# pip install openimages pillow pyyaml scikit-learn ultralytics

import os
import shutil
import yaml
from pathlib import Path
from sklearn.model_selection import train_test_split

# ============================================================================
# CONFIGURATION - Modify these settings as needed
# ============================================================================

CLASSES = [
    "Bowl",
    "Coffee cup", 
    "Mug",
    "Plate",
    "Spoon",
    "Fork",
    "Knife",
    "Wine glass",
    "Spatula",
]

# Paths
BASE_DIR = "sinksnitch_data"
TEMP_DIR = os.path.join(BASE_DIR, "openimages_temp")
YOLO_DIR = os.path.join(BASE_DIR, "yolo_dataset")

# Training settings
IMAGES_PER_CLASS = 200  # Download up to 200 images per class
TRAIN_SPLIT = 0.8  # 80% train, 20% validation
EPOCHS = 50
BATCH_SIZE = 16
IMG_SIZE = 640

# ============================================================================
# STEP 1: DOWNLOAD DATASET FROM OPENIMAGES
# ============================================================================

def download_openimages():
    """Download images from OpenImages dataset"""
    print("=" * 60)
    print("STEP 1: Downloading dataset from OpenImages")
    print("=" * 60)
    
    from openimages.download import download_dataset
    
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    print(f"Downloading {len(CLASSES)} classes...")
    print(f"Up to {IMAGES_PER_CLASS} images per class")
    print("This may take 5-15 minutes depending on internet speed...\n")
    
    try:
        download_dataset(
            TEMP_DIR, 
            CLASSES, 
            annotation_format="darknet",
            limit=IMAGES_PER_CLASS
        )
        print("\n✓ Download complete!")
    except Exception as e:
        print(f"\n✗ Download failed: {e}")
        print("Try reducing IMAGES_PER_CLASS or check your internet connection")
        return False
    
    return True

# ============================================================================
# STEP 2: ORGANIZE DATA FOR YOLO
# ============================================================================

def organize_for_yolo():
    """Organize downloaded images into YOLO format"""
    print("\n" + "=" * 60)
    print("STEP 2: Organizing dataset for YOLO")
    print("=" * 60)
    
    # Create YOLO directory structure
    for split in ['train', 'val']:
        os.makedirs(os.path.join(YOLO_DIR, 'images', split), exist_ok=True)
        os.makedirs(os.path.join(YOLO_DIR, 'labels', split), exist_ok=True)
    
    all_images = []
    all_labels = []
    
    print("\nScanning for images and labels...")
    
    # Find all downloaded images and their labels
    for class_name in CLASSES:
        # OpenImages might save with different naming conventions
        possible_names = [
            class_name,
            class_name.lower(),
            class_name.lower().replace(" ", "_"),
            class_name.replace(" ", "_")
        ]
        
        class_folder = None
        for name in possible_names:
            potential_path = os.path.join(TEMP_DIR, name)
            if os.path.exists(potential_path):
                class_folder = potential_path
                break
        
        if not class_folder:
            print(f"  ⚠ Warning: Could not find folder for '{class_name}'")
            continue
        
        images_dir = os.path.join(class_folder, "images")
        labels_dir = os.path.join(class_folder, "darknet")
        
        if not os.path.exists(images_dir):
            print(f"  ⚠ Warning: No images found for '{class_name}'")
            continue
        
        # Collect image-label pairs
        found_count = 0
        for img_file in os.listdir(images_dir):
            if img_file.endswith('.jpg'):
                img_path = os.path.join(images_dir, img_file)
                label_path = os.path.join(labels_dir, img_file.replace('.jpg', '.txt'))
                
                if os.path.exists(label_path):
                    all_images.append(img_path)
                    all_labels.append(label_path)
                    found_count += 1
        
        print(f"  ✓ {class_name}: {found_count} images")
    
    print(f"\nTotal images collected: {len(all_images)}")
    
    if len(all_images) == 0:
        print("✗ No images found! Check if download was successful.")
        return False
    
    # Split into train/val
    print(f"\nSplitting: {int(TRAIN_SPLIT*100)}% train, {int((1-TRAIN_SPLIT)*100)}% val...")
    train_images, val_images, train_labels, val_labels = train_test_split(
        all_images, all_labels, 
        train_size=TRAIN_SPLIT, 
        random_state=42
    )
    
    # Copy files to YOLO structure
    print("\nCopying files...")
    print("  Training set...")
    for img_path, label_path in zip(train_images, train_labels):
        shutil.copy(img_path, os.path.join(YOLO_DIR, 'images', 'train', os.path.basename(img_path)))
        shutil.copy(label_path, os.path.join(YOLO_DIR, 'labels', 'train', os.path.basename(label_path)))
    
    print("  Validation set...")
    for img_path, label_path in zip(val_images, val_labels):
        shutil.copy(img_path, os.path.join(YOLO_DIR, 'images', 'val', os.path.basename(img_path)))
        shutil.copy(label_path, os.path.join(YOLO_DIR, 'labels', 'val', os.path.basename(label_path)))
    
    print(f"\n✓ Dataset organized:")
    print(f"  Training: {len(train_images)} images")
    print(f"  Validation: {len(val_images)} images")
    
    return True

# ============================================================================
# STEP 3: CREATE DATA.YAML CONFIG
# ============================================================================

def create_config():
    """Create YOLO configuration file"""
    print("\n" + "=" * 60)
    print("STEP 3: Creating configuration file")
    print("=" * 60)
    
    data_yaml = {
        "path": os.path.abspath(YOLO_DIR),
        "train": "images/train",
        "val": "images/val",
        "nc": len(CLASSES),
        "names": {i: name for i, name in enumerate(CLASSES)},
    }
    
    yaml_path = os.path.join(YOLO_DIR, "data.yaml")
    with open(yaml_path, 'w') as f:
        yaml.dump(data_yaml, f, default_flow_style=False)
    
    print(f"\n✓ Config saved to: {yaml_path}")
    print(f"  Classes: {len(CLASSES)}")
    
    return yaml_path

# ============================================================================
# STEP 4: TRAIN MODEL
# ============================================================================

def train_model(config_path):
    """Fine-tune YOLOv8 on the dataset"""
    print("\n" + "=" * 60)
    print("STEP 4: Training YOLOv8 Model")
    print("=" * 60)
    
    from ultralytics import YOLO
    
    # Load pretrained model
    print("\nLoading pretrained YOLOv8n model...")
    model = YOLO('yolov8n.pt')
    
    print(f"\nTraining configuration:")
    print(f"  Epochs: {EPOCHS}")
    print(f"  Batch size: {BATCH_SIZE}")
    print(f"  Image size: {IMG_SIZE}")
    print(f"  Device: {model.device}")
    
    print("\n" + "=" * 60)
    print("Starting training... (this will take 30-60 minutes)")
    print("=" * 60 + "\n")
    
    # Train the model
    results = model.train(
        data=config_path,
        epochs=EPOCHS,
        batch=BATCH_SIZE,
        imgsz=IMG_SIZE,
        patience=10,  # Early stopping if no improvement for 10 epochs
        save=True,
        project='sinksnitch_training',
        name='dish_detector',
        exist_ok=True,
    )
    
    print("\n" + "=" * 60)
    print("✓ TRAINING COMPLETE!")
    print("=" * 60)
    
    # Find best model path
    best_model_path = os.path.join('sinksnitch_training', 'dish_detector', 'weights', 'best.pt')
    
    print(f"\nBest model saved to: {best_model_path}")
    print("\nTo use your trained model:")
    print(f"  model = YOLO('{best_model_path}')")
    
    return best_model_path

# ============================================================================
# STEP 5: VALIDATE MODEL
# ============================================================================

def validate_model(model_path):
    """Test the trained model"""
    print("\n" + "=" * 60)
    print("STEP 5: Validating Model Performance")
    print("=" * 60)
    
    from ultralytics import YOLO
    
    model = YOLO(model_path)
    
    print("\nRunning validation on test set...")
    metrics = model.val()
    
    print(f"\n✓ Validation Results:")
    print(f"  mAP@0.5: {metrics.box.map50:.3f}")
    print(f"  mAP@0.5:0.95: {metrics.box.map:.3f}")
    print(f"  Precision: {metrics.box.mp:.3f}")
    print(f"  Recall: {metrics.box.mr:.3f}")
    
    if metrics.box.map50 > 0.7:
        print("\n🎉 Great! Model performance is good (mAP > 0.7)")
    elif metrics.box.map50 > 0.5:
        print("\n✓ Decent performance (mAP > 0.5), should work for SinkSnitch")
    else:
        print("\n⚠ Lower performance. Consider training longer or adding more data")

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def main():
    print("\n" + "=" * 60)
    print("SinkSnitch - YOLOv8 Fine-tuning Pipeline")
    print("=" * 60)
    print(f"\nThis will:")
    print(f"  1. Download {IMAGES_PER_CLASS} images per class from OpenImages")
    print(f"  2. Organize data for YOLO training")
    print(f"  3. Fine-tune YOLOv8n for {EPOCHS} epochs")
    print(f"  4. Validate the trained model")
    print(f"\nEstimated time: 45-90 minutes")
    
    response = input("\nProceed? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        return
    
    # Run pipeline
    if not download_openimages():
        return
    
    if not organize_for_yolo():
        return
    
    config_path = create_config()
    
    model_path = train_model(config_path)
    
    validate_model(model_path)
    
    print("\n" + "=" * 60)
    print("🎉 PIPELINE COMPLETE!")
    print("=" * 60)
    print(f"\nYour trained model is ready to use!")
    print(f"\nNext steps:")
    print(f"  1. Test on your sink: model = YOLO('{model_path}')")
    print(f"  2. Compare with pretrained model")
    print(f"  3. If better, use this for SinkSnitch deployment")

if __name__ == "__main__":
    main()