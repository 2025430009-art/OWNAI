def zero_shot_heuristic(example):
    # Simple fallback heuristic for zero-shot classification.
    text = (example.get("text") or "").lower()
    if "not" in text or "no " in text:
        return 0
    return 1


def run_eval(dataset):
    preds = [zero_shot_heuristic(x) for x in dataset]
    return {"num_examples": len(preds), "sample_pred_mean": sum(preds) / max(len(preds), 1)}
