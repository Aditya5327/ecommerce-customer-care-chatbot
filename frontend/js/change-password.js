// ========================================
// Change Password
// ========================================

async function handleChangePassword(e) {
    e.preventDefault();

    const errorEl = document.getElementById(
        "change-password-error"
    );

    const successEl = document.getElementById(
        "change-password-success"
    );

    errorEl.textContent = "";
    successEl.textContent = "";

    const currentPassword =
        document.getElementById("current-password").value;

    const newPassword =
        document.getElementById("new-password").value;

    const confirmPassword =
        document.getElementById("confirm-password").value;


    // Check new passwords match

    if (newPassword !== confirmPassword) {
        errorEl.textContent =
            "New passwords do not match.";

        return;
    }


    // Minimum length

    if (newPassword.length < 6) {
        errorEl.textContent =
            "New password must be at least 6 characters.";

        return;
    }


    try {

        const res = await fetch(
            `${API_BASE}/auth/change-password`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders(),
                },

                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            }
        );


        const data = await res.json();


        if (!res.ok) {

            errorEl.textContent =
                data.message || "Failed to change password.";

            return;
        }


        successEl.textContent =
            "Password changed successfully!";


        // Clear fields

        document.getElementById(
            "change-password-form"
        ).reset();


    } catch (err) {

        errorEl.textContent =
            "Couldn't reach the server. Is the backend running?";

        console.error(err);
    }
}


// ========================================
// Show / Hide password
// ========================================

function setupPasswordToggles() {

    const buttons =
        document.querySelectorAll(".password-toggle");


    buttons.forEach((button) => {

        button.addEventListener("click", () => {

            const targetId =
                button.dataset.target;

            const input =
                document.getElementById(targetId);


            if (input.type === "password") {

                input.type = "text";

                button.textContent = "🙈";

                button.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                input.type = "password";

                button.textContent = "👁";

                button.setAttribute(
                    "aria-label",
                    "Show password"
                );
            }

        });

    });

}


// ========================================
// Init
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const form =
            document.getElementById(
                "change-password-form"
            );

        if (form) {

            form.addEventListener(
                "submit",
                handleChangePassword
            );

        }

        setupPasswordToggles();

    }
);