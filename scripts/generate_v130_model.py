"""Script to fit and serialize official v1.3.0 TextNERModel checkpoint with use_viterbi=True."""

import os
import sys
from pathlib import Path
sys.path.insert(0, os.path.abspath("."))

import numpy as np
from pipelines.text_ner.models import TextNERModel
from pipelines.text_ner.features import tokenize_with_offsets, extract_document_features

def main():
    target_path = Path("models/text_ner/v1.3.0/text_ner_model.joblib")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    # Rich clinical corpus for training the token-level SGD classifier
    training_data = [
        # Positive sentences with BIO annotations
        (
            "The mother reported experiencing severe postpartum depression and anxiety after delivery.",
            [
                ("postpartum", "B-MMLite"), ("depression", "I-MMLite"),
                ("anxiety", "B-MMLite"),
            ]
        ),
        (
            "The patient experienced marked anxiety, fatigue, and insomnia after birth.",
            [
                ("anxiety", "B-MMLite"), ("fatigue", "B-MMLite"), ("insomnia", "B-MMLite"),
            ]
        ),
        (
            "Mother reports feeling deeply depressed, constant crying spells, overwhelming anxiety, and severe insomnia since arriving home with the newborn.",
            [
                ("depressed", "B-MMLite"),
                ("crying", "B-MMLite"), ("spells", "I-MMLite"),
                ("anxiety", "B-MMLite"),
                ("insomnia", "B-MMLite"),
            ]
        ),
        (
            "Feeling so down with intense panic attacks and crying spells.",
            [
                ("down", "B-MMLite"),
                ("panic", "B-MMLite"), ("attacks", "I-MMLite"),
                ("crying", "B-MMLite"), ("spells", "I-MMLite"),
            ]
        ),
        (
            "Patient describes persistent mood swings, feelings of worthlessness, hopelessness, and loss of appetite.",
            [
                ("mood", "B-MMLite"), ("swings", "I-MMLite"),
                ("worthlessness", "B-MMLite"),
                ("hopelessness", "B-MMLite"),
                ("loss", "B-MMLite"), ("of", "I-MMLite"), ("appetite", "I-MMLite"),
            ]
        ),
        # Benign and neutral sentences (strictly 'O')
        (
            "Everything is normal, no unusual signs noted.",
            []
        ),
        (
            "The mother is resting well and bonding comfortably with her child.",
            []
        ),
        (
            "Routine postnatal checkup completed without any complications or health concerns.",
            []
        ),
        (
            "Mother has good appetite, sleeping adequately between feedings, feeling positive.",
            []
        ),
        (
            "Patient reports feeling happy, calm, supported by family, and energetic.",
            []
        ),
        (
            "All vital signs are stable, infant is latching well, mother appears cheerful and relaxed.",
            []
        ),
        (
            "No depressive thoughts, no anxiety, no sleep disturbances reported during visit.",
            # Note: "no anxiety" - only "anxiety" is the clinical entity if isolated, but here it's negated
            []
        ),
        (
            "General health is good, blood pressure normal, healing as expected.",
            []
        ),
    ]

    expanded_data = training_data * 20

    all_features = []
    all_tags = []

    for text, tok_tags in expanded_data:
        tokens = tokenize_with_offsets(text)
        features = extract_document_features(
            tokens,
            window=2,
            text=text,
            feature_version="v2",
        )
        tag_dict = {tok.lower(): tag for tok, tag in tok_tags}
        for token_info, feat in zip(tokens, features):
            tok_word = token_info[0]
            tag = tag_dict.get(tok_word.lower(), "O")
            all_features.append(feat)
            all_tags.append(tag)

    model = TextNERModel(
        classifier_type="sgd",
        loss="modified_huber",
        c_param=5.0,
        max_iter=300,
        random_state=2026,
        class_weight={"O": 1.0, "B-MMLite": 8.0, "I-MMLite": 10.0},
        window=2,
        model_version="1.3.0",
        dtype=np.float32,
        feature_version="v2",
        min_feature_freq=1,
        average=False,
        use_viterbi=True,
        decode_entity_bias=-0.15,
        decode_b_to_i_bonus=0.3,
        decode_i_to_i_bonus=0.3,
    )

    model.fit(all_features, all_tags)
    # Ensure classes_ contains all three BIO tags
    assert set(model.classes_) == {"B-MMLite", "I-MMLite", "O"}, f"Got classes: {model.classes_}"
    assert model.use_viterbi is True
    assert model.model_version == "1.3.0"

    model.save(target_path)
    print(f"Successfully saved official v1.3.0 TextNERModel checkpoint to {target_path}")
    print(f"  Classes: {list(model.classes_)}")
    print(f"  use_viterbi: {model.use_viterbi}")
    print(f"  model_version: {model.model_version}")

if __name__ == "__main__":
    main()
