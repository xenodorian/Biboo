from swingkit import checks


def test_frame_count():
    ok, msg = checks.check_frame_count(); assert ok, msg


def test_arm_lengths():
    ok, msg = checks.check_arm_lengths(); assert ok, msg


def test_lead_upper_arm():
    ok, msg = checks.check_lead_upper_arm(); assert ok, msg


def test_leg_lengths():
    ok, msg = checks.check_leg_lengths(); assert ok, msg


def test_feet_planted():
    ok, msg = checks.check_feet_planted(); assert ok, msg


def test_rear_hand_on_pommel():
    ok, msg = checks.check_rear_hand_on_pommel(); assert ok, msg


def test_lead_arm_behind_grip():
    ok, msg = checks.check_lead_arm_behind_grip(); assert ok, msg


def test_face_clear():
    ok, msg = checks.check_face_clear(); assert ok, msg


def test_tiling():
    ok, msg = checks.check_tiling(); assert ok, msg


def test_gif_roundtrip(tmp_path):
    from swingkit import build
    frames = build.build(tmp_path, scales=(1,), log=lambda *a: None)
    ok, msg = checks.check_gif(tmp_path / 'swing_x1.gif', frames, 1); assert ok, msg
